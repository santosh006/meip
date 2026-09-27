import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'news_loader'))
from storage import Store
from models import Article
from worker import claim

class StorageTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.old_data = os.environ.get('DATA_DIR')
        os.environ['DATA_DIR'] = self.tmp.name
        self.store = Store(Path(self.tmp.name) / 'news.sqlite')
    def tearDown(self):
        self.store.close()
        if self.old_data is None: os.environ.pop('DATA_DIR', None)
        else: os.environ['DATA_DIR'] = self.old_data
        self.tmp.cleanup()
    def test_deduplication_preserves_original(self):
        article = Article(source='test', title='Original', url='https://example.com', tickers=['TCS'])
        self.assertEqual(self.store.save([article]), 1)
        article.title = 'Edited'
        self.assertEqual(self.store.save([article]), 0)
        self.assertEqual(self.store.conn.execute('SELECT title FROM articles').fetchone()[0], 'Original')
    def test_review_tombstone_prevents_reingestion(self):
        article = Article(source='test', title='Original', url='https://example.com')
        self.store.conn.execute('INSERT INTO article_reviews(dedupe_key,decision) VALUES(?,?)', (article.dedupe_key(), 'rejected'))
        self.store.conn.commit()
        self.assertEqual(self.store.save([article]), 0)
        self.assertEqual(self.store.conn.execute('SELECT count(*) FROM articles').fetchone()[0], 0)
    def test_worker_claims_a_job_once(self):
        payload = json.dumps({'ticker':'TCS','sources':[],'days':1,'limit':50})
        self.store.conn.execute('INSERT INTO ingestion_jobs(id,requested_by,payload) VALUES(?,?,?)', ('job','user',payload))
        self.store.conn.commit()
        self.assertEqual(claim(self.store.conn)[0], 'job')
        self.assertIsNone(claim(self.store.conn))

if __name__ == '__main__': unittest.main()
