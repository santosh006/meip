from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import Base, engine
from app.routes import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes first, so /api/... is handled before static files.
app.include_router(router)

# Resolves to <project-root>/public
public_directory = Path(__file__).resolve().parent.parent / "public"

app.mount(
    "/",
    StaticFiles(directory=str(public_directory), html=True),
    name="public",
)
