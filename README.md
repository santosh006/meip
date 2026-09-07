# Meip

A beginner-friendly full-stack Task Manager built with Python, FastAPI, PostgreSQL, plain HTML, CSS, and JavaScript.

The project is designed to be deployed on Vercel, stored on GitHub, and connected to a hosted PostgreSQL database.

## Features

- Create tasks
- View all tasks
- Mark tasks as complete or incomplete
- Delete tasks
- Store task data in PostgreSQL
- FastAPI backend API
- Simple frontend with HTML, CSS, and JavaScript
- Automated testing through GitHub Actions
- Automatic deployment through Vercel

## Tech Stack

| Area | Technology |
| :--- | :--- |
| Backend | Python 3 + FastAPI |
| Database | PostgreSQL |
| Database toolkit | SQLAlchemy |
| Validation | Pydantic |
| Frontend | HTML, CSS, JavaScript |
| Hosting | Vercel |
| Source control | Git and GitHub |
| CI/CD | GitHub Actions and Vercel |

## Project Structure

```text
meip/
├── api/
│   └── index.py              # Vercel serverless entry point
├── app/
│   ├── __init__.py
│   ├── database.py           # Database configuration
│   ├── models.py             # SQLAlchemy database models
│   ├── routes.py             # FastAPI API routes
│   └── schemas.py            # Pydantic request and response models
├── public/
│   ├── index.html            # Application page
│   ├── styles.css            # Frontend styles
│   └── app.js                # Frontend JavaScript
├── tests/
│   ├── __init__.py
│   └── test_api.py           # Automated API tests
├── .github/
│   └── workflows/
│       └── tests.yml         # GitHub Actions test workflow
├── .gitignore
├── README.md
├── requirements.txt          # Python dependencies
└── vercel.json               # Vercel configuration

# postgre-command
docker compose exec db psql -U meip_admin -d meip_db