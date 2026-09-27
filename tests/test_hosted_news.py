import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'news_loader'))
import hosted
from models import Article
from storage import Store

class HostedTests(unittest.TestCase):
    def test_hosted_store_never_opens_sqlite(self):
        with patch.dict(os.environ, {'NEWS_STORAGE': 'supabase'}), patch('storage.sqlite3.connect', side_effect=AssertionError('Local DB opened')):
            self.assertIsInstance(Store(), hosted.HostedStore)

    def test_article_payload_preserves_original_and_normalizes_tickers(self):
        with patch('hosted.rpc', return_value=1) as rpc:
            self.assertEqual(hosted.HostedStore().save([Article(source='test',title='Original',tickers=[' tcs '],raw={'a':1})]),1)
            row=rpc.call_args.args[1]['articles'][0]
            self.assertEqual(row['tickers'],'TCS')
            self.assertEqual(row['raw'],'{"a": 1}')
            self.assertEqual(len(row['dedupe_key']),40)

    def test_timeout_finishes_with_lease_token(self):
        job={'id':'job','token':'token','payload':{'ticker':'TCS','days':1,'limit':10,'sources':[]}}
        with patch('hosted.subprocess.run', side_effect=hosted.subprocess.TimeoutExpired('cmd',900)), patch('hosted.rpc') as rpc:
            hosted.run_job(job)
            self.assertEqual(rpc.call_args.args[0],'finish')
            result=rpc.call_args.args[1]
            self.assertFalse(result['success'])
            self.assertEqual(result['token'],'token')

class MigrationTests(unittest.TestCase):
    def test_snapshot_preserves_decisions_and_does_not_mutate_sqlite(self):
        import importlib.util
        import tempfile
        spec=importlib.util.spec_from_file_location('migrate_news',Path(__file__).resolve().parents[1]/'scripts/migrate-news-sqlite.py')
        module=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as tmp, patch.dict(os.environ, {'NEWS_STORAGE':'sqlite','DATA_DIR':tmp}):
            path=Path(tmp)/'news.sqlite'
            store=Store(path)
            article=Article(source='test',title='Pending',tickers=['TCS'])
            store.save([article])
            store.conn.execute("INSERT INTO article_reviews(dedupe_key,decision,headline,reason) VALUES('legacy','accepted','Legacy','review')")
            store.conn.commit()
            rows=module.snapshot(path)
            self.assertEqual(len(rows),2)
            legacy=next(row for row in rows if row['dedupe_key']=='legacy')
            self.assertEqual(legacy['decision'],'accepted')
            self.assertEqual(legacy['event']['title'],'Legacy')
            self.assertIsNone(legacy['event']['summary'])
            self.assertEqual(store.conn.execute('SELECT count(*) FROM articles').fetchone()[0],1)
            store.close()
