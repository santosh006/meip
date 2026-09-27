"""Run separately from Next.js; jobs and review data live on a shared local volume."""
import json
import os
import sqlite3
import subprocess
import sys
import time
from pathlib import Path
from config import load_env
from storage import Store

ROOT = Path(__file__).resolve().parent

def claim(conn):
    conn.execute('BEGIN IMMEDIATE')
    try:
        row = conn.execute("SELECT id,payload FROM ingestion_jobs WHERE status='queued' ORDER BY created_at,rowid LIMIT 1").fetchone()
        if row:
            conn.execute("UPDATE ingestion_jobs SET status='running',started_at=datetime('now') WHERE id=?", (row[0],))
        conn.commit()
        return row
    except Exception:
        conn.rollback()
        raise

def run_job(conn, row, lock_fd=None):
    job_id, raw = row
    payload = json.loads(raw)
    start_id = conn.execute('SELECT COALESCE(MAX(id),0) FROM run_log').fetchone()[0]
    args = [sys.executable, str(ROOT / 'main.py'), '--symbols', payload['ticker'], '--days', str(payload['days']), '--limit', str(payload['limit'])]
    if payload['sources']:
        args += ['--sources', ','.join(payload['sources'])]
    try:
        # One worker owns the DB lock; run_log entries cannot overlap other jobs.
        result = subprocess.run(args, cwd=ROOT, timeout=900, check=False, pass_fds=(() if lock_fd is None else (lock_fd,)))
        logs = conn.execute('SELECT source,status,inserted FROM run_log WHERE id>?', (start_id,)).fetchall()
        warnings = [{'source': source, 'status': status, 'message': 'Source did not complete. See worker logs.'} for source,status,_ in logs if status != 'ok']
        success = result.returncode == 0 and any(status == 'ok' for _,status,_ in logs)
        output = {'articlesNew': sum(n or 0 for _,_,n in logs), 'warnings': warnings}
        if not success:
            output['error'] = 'No source completed successfully. Check worker configuration and logs.'
    except subprocess.TimeoutExpired:
        success, output = False, {'error': 'Ingestion timed out. Try fewer sources.'}
    except Exception:
        success, output = False, {'error': 'Worker failed. Check worker logs.'}
    conn.execute("UPDATE ingestion_jobs SET status=?,result=?,finished_at=datetime('now') WHERE id=?", ('succeeded' if success else 'failed', json.dumps(output), job_id))
    conn.commit()

def main():
    import fcntl
    load_env()
    store = Store()
    # Exactly one worker per SQLite volume, including across process restarts.
    with open(str(store.db_path) + '.worker.lock', 'w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print('News worker already running for this database.', flush=True)
            store.close()
            return
        print('News worker started.', flush=True)
        conn = store.conn
        conn.execute("UPDATE ingestion_jobs SET status='queued' WHERE status='running'")
        conn.commit()
        catalogue_at = None
        while True:
            if catalogue_at is None or time.monotonic() - catalogue_at > 60:
                try:
                    result = subprocess.run([sys.executable, str(ROOT / 'main.py'), '--list', '--json'], cwd=ROOT, capture_output=True, text=True, timeout=30, check=True)
                    payload = json.loads(result.stdout.strip().splitlines()[-1])
                    conn.execute("INSERT INTO source_catalogue VALUES(1,?,datetime('now')) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at", (json.dumps(payload),))
                    conn.commit()
                    if catalogue_at is None:
                        print('News source catalogue ready.', flush=True)
                    catalogue_at = time.monotonic()
                except (subprocess.SubprocessError, ValueError):
                    print('Unable to refresh source catalogue', file=sys.stderr)
                    catalogue_at = time.monotonic()
            row = claim(conn)
            if row: run_job(conn, row, lock.fileno())
            else: time.sleep(2)

if __name__ == '__main__':
    main()
