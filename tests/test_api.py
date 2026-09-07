import pytest
from fastapi.testclient import TestClient

from api.index import app


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_health_check(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_task_lifecycle(client):
    # Create
    create_response = client.post(
        "/api/tasks",
        json={
            "title": "Write API tests",
            "description": "Test create, update, and delete",
        },
    )

    assert create_response.status_code == 201

    task = create_response.json()
    task_id = task["id"]
    assert task["title"] == "Write API tests"
    assert task["completed"] is False

    # Read
    list_response = client.get("/api/tasks")

    assert list_response.status_code == 200
    assert any(item["id"] == task_id for item in list_response.json())

    # Update
    update_response = client.patch(
        f"/api/tasks/{task_id}",
        json={"completed": True},
    )

    assert update_response.status_code == 200
    assert update_response.json()["id"] == task_id
    assert update_response.json()["completed"] is True

    # Delete
    delete_response = client.delete(f"/api/tasks/{task_id}")

    assert delete_response.status_code == 204

    # Confirm that updating the removed task returns 404
    missing_response = client.patch(
        f"/api/tasks/{task_id}",
        json={"completed": False},
    )

    assert missing_response.status_code == 404
