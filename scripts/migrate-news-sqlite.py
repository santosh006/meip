#!/usr/bin/env python3
"""Read a stopped SQLite queue and import it without deleting the original.
Use --sql FILE to write a transaction for Supabase CLI/SQL editor, or supply
worker service credentials to import directly. Old unfinished jobs must be retried.
"""
import argparse
import json
import sqlite3
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'news_loader'))
from hosted import rpc

def snapshot(path):
    conn=sqlite3.connect(Path(path).resolve().as_uri()+'?mode=ro',uri=True)
    conn.row_factory=sqlite3.Row
    conn.execute('BEGIN')
    tables={row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    def rows(table):
        return [dict(row) for row in conn.execute('SELECT * FROM '+table)] if table in tables else []
    articles={row['dedupe_key']:row for row in rows('articles')}
    for mapping in rows('article_tickers'):
        article=articles.get(mapping['dedupe_key'])
        if article is not None:
            symbols=set(filter(None,(article.get('tickers') or '').split(',')))
            symbols.add(mapping['ticker'])
            article['tickers']=','.join(sorted(symbols))
    reviews={row['dedupe_key']:row for row in rows('article_reviews')}
    intents={row['dedupe_key']:row for row in rows('review_intents')}
    exports={row['dedupe_key']:row['event_id'] for row in rows('news_event_exports')}
    now=datetime.now(timezone.utc).isoformat()
    result=[]
    for key in articles.keys() | reviews.keys() | intents.keys():
        review=reviews.get(key) or intents.get(key) or {}
        saved=json.loads(review.get('payload') or '{}')
        payload=articles.get(key) or {'dedupe_key':key,'title':review.get('headline') or 'Accepted news',
                'source':review.get('source'), 'tickers':review.get('ticker'), 'fetched_at':review.get('reviewed_at') or now}
        item={'dedupe_key':key,'payload':payload}
        if review:
            item.update(decision=review['decision'],reason=review.get('reason') or saved.get('reason') or '',
                        reviewer_id=review.get('reviewer_id'),reviewed_at=review.get('reviewed_at'))
            if review['decision']=='accepted':
                event=saved.get('event') or {
                    'id': exports.get(key) or str(uuid.uuid5(uuid.NAMESPACE_DNS,key)),
                    'title':payload['title'],'event_type':'news','occurred_at':payload.get('published_at') or payload.get('fetched_at') or now,
                    'summary':payload.get('summary') or payload.get('body'),'source_url':payload.get('url'),
                    'entity_id':(saved.get('record') or {}).get('entity_id'),
                    'raw':{'dedupe_key':key,'source':payload.get('source'),'tickers':(payload.get('tickers') or '').split(','),
                           'original':payload.get('raw'),'review':{'decision':'accepted','reason':item['reason'],'reviewer_id':item['reviewer_id']}}}
                item['event']=event
        result.append(item)
    conn.close()
    return result

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('database')
    parser.add_argument('--sql',help='Write SQL instead of sending it')
    args=parser.parse_args()
    rows=snapshot(args.database)
    batches=[{'articles':rows[i:i+50]} for i in range(0,len(rows),50)]
    if args.sql:
        statements=['BEGIN;']
        for batch in batches:
            # A quoted SQL string; embedded apostrophes are doubled.
            value=json.dumps(batch).replace("'","''")
            statements.append("SELECT public.news_worker('import','"+value+"'::jsonb);")
        statements.append('COMMIT;')
        Path(args.sql).write_text('\n'.join(statements)+'\n')
    else:
        for batch in batches: rpc('import',batch)
    print(f'Prepared {len(rows)} article/review records.' if args.sql else f'Imported {len(rows)} article/review records.')

if __name__=='__main__': main()
