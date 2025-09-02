# Demo Template: Python Backend with Next.js Frontend

This repository provides a template for creating a web application with a Python backend and a Next.js frontend. The backend is managed using uv for dependency management, while the frontend is built with Next.js, offering a modern React-based user interface.

## Table of Contents

- [Demo Template: Python Backend with Next.js Frontend](#demo-template-python-backend-with-nextjs-frontend)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Prerequisites](#prerequisites)
  - [Getting Started](#getting-started)
    - [Create a New Repository](#create-a-new-repository)
    - [GitHub Desktop Setup](#github-desktop-setup)
    - [Backend Setup](#backend-setup)
  - [DEMO README](#demo-readme)

## Features

- Python backend with a RESTful API powered by [FastAPI](https://fastapi.tiangolo.com/)
- Next.js frontend for a responsive user interface
- Dependency management with uv ([More info](https://docs.astral.sh/uv/))
- Easy setup and configuration

## Prerequisites

Before you begin, ensure you have met the following requirements:

- Python >=3.13,<3.14 - If you are Mac user, you can install Python 3.13 using this [link](https://www.python.org/downloads/).
- Node.js 22 or higher
- uv (install via [uv's official documentation](https://docs.astral.sh/uv/getting-started/installation/))

## Getting Started

Follow these steps to set up the project locally.

### Create a New Repository

1. Navigate to the repository template on GitHub and click on **Use this template**.
2. Create a new repository.
3. **Do not** check the "Include all branches" option.
4. Define a repository name following the naming convention: `<industry>-<project_name>-<highlighted_feature>`. For example, `fsi-leafybank-ai-personal-assistant` (use hyphens to separate words).
   - The **industry** and **project name** are required; you can be creative with the highlighted feature.
5. Provide a clear description for the repository, such as: "A repository template to easily create new demos by following the same structure."
6. Set the visibility to **Internal**.
7. Click **Create repository**.

### GitHub Desktop Setup

1. Install GitHub Desktop if you haven't already. You can download it from [GitHub Desktop's official website](https://desktop.github.com/).
2. Open GitHub Desktop and sign in to your GitHub account.
3. Clone the newly created repository:
   - Click on **File** > **Clone Repository**.
   - Select your repository from the list and click **Clone**.
4. Create your first branch:
   - In the GitHub Desktop interface, click on the **Current Branch** dropdown.
   - Select **New Branch** and name it `feature/branch01`.
   - Click **Create Branch**.

### Backend Setup

1. (Optional) Set your project description and author information in the `pyproject.toml` file:
   ```toml
   description = "Your Description"
   authors = ["Your Name <you@example.com>"]
2. Open the project in your preferred IDE (the standard for the team is Visual Studio Code).
3. Open the Terminal within Visual Studio Code.
4. Ensure you are in the root project directory where the `makefile` is located.
5. Execute the following commands:
  - uv initialization
    ````bash
    make uv_init
    ````
  - uv sync
    ````bash
    make uv_sync
    ````
6. Verify that the `.venv` folder has been generated within the `/backend` directory.

### Running Backend Locally

After setting up the backend dependencies, you can run the development server:

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Start the FastAPI development server:
   ```bash
   uv run uvicorn main:app --host 0.0.0.0 --port 8000
   ```

3. The backend API will be accessible at http://localhost:8000

**Note**: If port 8000 is already in use (e.g., by Docker containers), either stop the containers with `make clean` or use a different port like `--port 8001`.

### Frontend Setup

1. Navigate to the `frontend` folder.
2. Install dependencies by running:
```bash
npm install
```
3. Start the frontend development server with:
````bash
npm run dev
````
4. The frontend will now be accessible at http://localhost:3000 by default, providing a user interface.

## DEMO README

<h1 style="color:red">REPLACE THE CONTENT OF THIS README WITH `README-demo.md` and DELETE THE `README-demo.md` FILE!!!!!!!!! </h1>