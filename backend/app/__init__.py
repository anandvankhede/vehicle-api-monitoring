"""
Backend Application Package - Vehicle API Monitoring
=====================================================

This package contains the complete backend implementation for the
Vehicle API Monitoring system. It is built with FastAPI and MongoDB (Motor).

Package Structure:
    - main.py          : FastAPI application entry point
    - config.py        : Application configuration (env vars)
    - database.py      : MongoDB connection manager
    - models/          : MongoDB document models (data layer)
    - schemas/         : Pydantic schemas (request/response validation)
    - routers/         : API route handlers (controller layer)
    - services/        : Business logic (service layer)
    - utils/           : Helper utilities (security, formatting)
    - dependencies/    : FastAPI dependency injectors

Developer Quick Start:
    1. Install dependencies:  pip install -r requirements.txt
    2. Create .env file:       cp .env.example .env
    3. Seed the database:      python -m app.utils.seed_data
    4. Run the server:         uvicorn app.main:app --reload
"""
