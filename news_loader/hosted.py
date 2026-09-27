"""Supabase-backed ingestion. Service credentials belong only on the worker host."""
import json
import os
import subprocess
import sys
import threading
import time
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parent

def rpc(action, args=None):
    base = os.environ.get('SUPABASE_URL') or os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if not base or not key:
        raise RuntimeError('Hosted worker requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    request = Request(base.rstrip('/') + '/rest/v1/rpc/news_worker',
        data=json.dumps({'action': action, 'args': args or {}}, default=str).encode(),
        headers={'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
    try:
        with urlopen(request, timeout=60) as response:
            return json.load(response)
    except HTTPError as exc:
        # Never include request headers or credentials in logs.
        raise RuntimeError(f'Hosted news operation {action} failed (HTTP {exc.code}); check migration and worker credentials') from None

class HostedStore:
    db_path = 'Supabase hosted news storage'

    def archive_raw(self, source, payload):
        rpc('archive', {'source': source, 'payload': payload})

    def save(self, articles):
        rows = []
        for article in articles:
            row = asdict(article)
            row.update(dedupe_key=article.dedupe_key(), first_seen_at=datetime.now(timezone.utc).isoformat(),
                       tickers=','.join(t.strip().upper() for t in article.tickers),
                       categories=','.join(article.categories), raw=json.dumps(article.raw, default=str))
            rows.append(row)
        return sum(rpc('save', {'articles': rows[i:i+50]}) for i in range(0, len(rows), 50))

    def start_run(self, source):
        return rpc('run_start', {'source': source, 'job_id': os.environ.get('NEWS_JOB_ID'), 'token': os.environ.get('NEWS_JOB_TOKEN')})

    def finish_run(self, run_id, fetched, inserted, status, message=''):
        rpc('run_finish', {'id': run_id, 'fetched': fetched, 'inserted': inserted, 'status': status, 'message': message[:2000]})

    def counts_by_source(self):
        return [(row['source'], row['count']) for row in rpc('stats')]

    def close(self):
        pass

def publish_catalogue():
    result = subprocess.run([sys.executable, str(ROOT/'main.py'), '--list', '--json'], cwd=ROOT,
                            capture_output=True, text=True, timeout=30, check=True)
    rpc('catalogue', json.loads(result.stdout.strip().splitlines()[-1]))

def run_job(job):
    payload = job['payload']
    args = [sys.executable, str(ROOT/'main.py'), '--symbols', payload['ticker'], '--days', str(payload['days']), '--limit', str(payload['limit'])]
    if payload.get('sources'):
        args += ['--sources', ','.join(payload['sources'])]
    env = {**os.environ, 'NEWS_STORAGE': 'supabase', 'NEWS_JOB_ID': job['id'], 'NEWS_JOB_TOKEN': job['token']}
    success = False
    try:
        result = subprocess.run(args, cwd=ROOT, env=env, timeout=900, check=False)
        logs = rpc('logs', {'id': job['id'], 'token': job['token']})
        success = result.returncode == 0 and any(log.get('status') == 'ok' for log in logs)
        output = {'articlesNew': sum(log.get('inserted', 0) for log in logs),
                  'warnings': [{'source': log['source'], 'status': log['status'], 'message': 'Source did not complete. See worker logs.'}
                               for log in logs if log.get('status') != 'ok']}
        if not success:
            output['error'] = 'No source completed successfully. Check worker configuration and logs.'
    except subprocess.TimeoutExpired:
        output = {'error': 'Ingestion timed out. Try fewer sources.'}
    except Exception as exc:
        print(f'Hosted job failed: {type(exc).__name__}', file=sys.stderr, flush=True)
        output = {'error': 'Worker failed. Check worker logs.'}
    rpc('finish', {'id': job['id'], 'token': job['token'], 'success': success, 'result': output})

def main():
    # Validate credentials and schema before announcing readiness.
    publish_catalogue()
    print('Hosted news worker ready.', flush=True)
    stopped = threading.Event()
    def heartbeat():
        while not stopped.wait(60):
            try:
                publish_catalogue()
            except Exception as exc:
                print(f'Catalogue refresh failed: {type(exc).__name__}', file=sys.stderr, flush=True)
    thread = threading.Thread(target=heartbeat, daemon=True)
    thread.start()
    try:
        while True:
            try:
                job = rpc('claim')
                if job:
                    run_job(job)
                else:
                    time.sleep(3)
            except Exception as exc:
                print(f'Hosted worker retrying: {type(exc).__name__}', file=sys.stderr, flush=True)
                time.sleep(10)
    finally:
        stopped.set()
