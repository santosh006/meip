import path from 'node:path';
export const loaderRoot = path.resolve(process.env.NEWSLOADER_ROOT ?? path.join(process.cwd(), 'news_loader'));
export const newsDbPath = path.resolve(process.env.NEWS_DB_PATH ?? path.join(loaderRoot, 'data', 'news.sqlite'));
