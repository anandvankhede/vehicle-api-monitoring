# Backend Implementation Guide - FastAPI
## Vehicle API Monitoring System

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Project Setup](#project-setup)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Implementation Steps](#implementation-steps)
6. [Testing](#testing)
7. [Frontend Integration](#frontend-integration)
8. [Deployment](#deployment)

---

## Prerequisites

### Required Software
- Python 3.9+
- PostgreSQL 12+ (or MySQL 8.0+)
- Redis (optional, for caching)
- Git

### Python Packages
```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
sqlalchemy==2.0.23
alembic==1.12.1
pydantic==2.5.0
pydantic-settings==2.1.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
psycopg2-binary==2.9.9
python-dotenv==1.0.0
pytest==7.4.3
pytest-asyncio==0.21.1
httpx==0.25.2
```

---

## Project Setup

### 1. Create Project Structure
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI application entry
│   ├── config.py               # Configuration settings
│   ├── database.py             # Database connection
│   ├── models/                 # SQLAlchemy models
│   │   ├── __init__.py
│   │   ├── client.py
│   │   ├── user.py
│   │   ├── api_request.py
│   │   └── report.py
│   ├── schemas/                # Pydantic schemas
│   │   ├── __init__.py
│   │   ├── client.py
│   │   ├── user.py
│   │   ├── api_request.py
│   │   └── report.py
│   ├── routers/                # API routes
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── client.py
│   │   ├── api_request.py
│   │   ├── report.py
│   │   └── admin.py
│   ├── services/               # Business logic
│   │   ├── __init__.py
│   │   ├── auth_service.py
│   │   ├── client_service.py
│   │   └── report_service.py
│   ├── dependencies/           # Shared dependencies
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   └── database.py
│   └── utils/                  # Helper functions
│       ├── __init__.py
│       ├── security.py
│       └── helpers.py
├── alembic/                    # Database migrations
├── tests/                      # Test files
├── .env                        # Environment variables
├── .env.example               # Environment template
└── requirements.txt
```

### 2. Initialize Project
```bash
mkdir backend && cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic init alembic
```

### 3. Environment Configuration
Create `.env` file:
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/vehicle_api_db

# Security
SECRET_KEY=your-secret-key-here-minimum-32-characters-long
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# API
API_V1_PREFIX=/api/v1
PROJECT_NAME=Vehicle API Monitoring
VERSION=1.0.0

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Redis (optional)
REDIS_URL=redis://localhost:6379/0
```

---

## Database Schema

### 1. Clients Table
```sql
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Users Table (Admin)
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3. APIs Table
```sql
CREATE TABLE apis (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    endpoint VARCHAR(500) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 4. Client API Access Table
```sql
CREATE TABLE client_api_access (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    api_id INTEGER REFERENCES apis(id) ON DELETE CASCADE,
    success_price_per_hit DECIMAL(10, 4) NOT NULL,
    not_found_price_per_hit DECIMAL(10, 4) NOT NULL,
    current_usage INTEGER DEFAULT 0,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expiry_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(client_id, api_id)
);
```

### 5. API Requests Table
```sql
CREATE TABLE api_requests (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    api_id INTEGER REFERENCES apis(id) ON DELETE CASCADE,
    request_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    response_status VARCHAR(50) NOT NULL,  -- success, failed, not_found
    response_time INTEGER,  -- in milliseconds
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_data JSONB
);
```

### 6. Usage Reports Table (Pre-computed)
```sql
CREATE TABLE usage_reports (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    api_id INTEGER REFERENCES apis(id) ON DELETE CASCADE,
    report_date DATE NOT NULL,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    not_found_count INTEGER DEFAULT 0,
    total_cost DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(client_id, api_id, report_date)
);
```

### 7. Invoices Table
```sql
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    gst_percentage DECIMAL(5, 2) DEFAULT 18,
    gst_amount DECIMAL(10, 2) NOT NULL,
    grand_total DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP
);
```

---

## API Endpoints

### Authentication
```
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
```

### Client Management
```
GET    /api/v1/clients                    # List all clients (admin)
POST   /api/v1/clients                    # Create client (admin)
GET    /api/v1/clients/{id}               # Get client details
PUT    /api/v1/clients/{id}               # Update client
DELETE /api/v1/clients/{id}               # Delete client
GET    /api/v1/clients/{id}/apis          # Get client's APIs
POST   /api/v1/clients/{id}/apis          # Assign API to client
DELETE /api/v1/clients/{id}/apis/{api_id} # Remove API access
```

### API Requests
```
POST /api/v1/api-requests/track           # Track new API request
GET  /api/v1/api-requests                 # Get requests (with filters)
GET  /api/v1/api-requests/stats           # Get aggregated stats
```

### Reports
```
GET /api/v1/reports/daily                 # Daily usage report
GET /api/v1/reports/monthly               # Monthly consumption report
GET /api/v1/reports/summary               # Usage summary
GET /api/v1/reports/table                 # Detailed report table
GET /api/v1/reports/export                # Export report (excel/csv/pdf)
```

### Invoices
```
POST /api/v1/invoices/generate            # Generate invoice
GET  /api/v1/invoices                     # List invoices
GET  /api/v1/invoices/{id}                # Get invoice details
PUT  /api/v1/invoices/{id}/status         # Update invoice status
```

---

## Implementation Steps

### Step 1: Database Models

**File: `app/models/client.py`**
```python
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Client(Base):
    __tablename__ = "clients"
    
    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(255), nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(20))
    address = Column(String(500))
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    api_access = relationship("ClientApiAccess", back_populates="client")
    api_requests = relationship("ApiRequest", back_populates="client")
    invoices = relationship("Invoice", back_populates="client")
```

**File: `app/models/api_request.py`**
```python
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Boolean
from datetime import datetime
from app.database import Base

class ApiRequest(Base):
    __tablename__ = "api_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    api_id = Column(Integer, ForeignKey("apis.id"), nullable=False)
    request_time = Column(DateTime, default=datetime.utcnow, index=True)
    response_status = Column(String(50), nullable=False)  # success, failed, not_found
    response_time = Column(Integer)  # milliseconds
    ip_address = Column(String(45))
    user_agent = Column(String(500))
    request_data = Column(JSON)
    
    # Relationships
    client = relationship("Client", back_populates="api_requests")
```

**File: `app/models/report.py`**
```python
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Numeric, Date
from datetime import datetime
from app.database import Base

class UsageReport(Base):
    __tablename__ = "usage_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    api_id = Column(Integer, ForeignKey("apis.id"), nullable=False)
    report_date = Column(Date, nullable=False, index=True)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    not_found_count = Column(Integer, default=0)
    total_cost = Column(Numeric(10, 2), default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
```

### Step 2: Pydantic Schemas

**File: `app/schemas/report.py`**
```python
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date

class DailyUsageReport(BaseModel):
    date: str
    success_requests: int
    failed_requests: int
    not_found_requests: int
    total_requests: int
    revenue: float
    cost: float
    avg_response_time: float

class MonthlyConsumptionReport(BaseModel):
    month: str
    year: int
    total_requests: int
    success_requests: int
    failed_requests: int
    not_found_requests: int
    total_cost: float
    total_revenue: float
    avg_daily_usage: int
    top_apis: List[dict]
    peak_usage_date: str

class ReportTableRow(BaseModel):
    id: int
    date: str
    client_name: str
    api_name: str
    endpoint: str
    success: int
    failed: int
    not_found: int
    total_requests: int
    total_cost: float
    invoice_status: str
```

### Step 3: API Routes

**File: `app/routers/report.py`**
```python
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date, datetime
from app.database import get_db
from app.models.client import Client
from app.models.api_request import ApiRequest
from app.models.report import UsageReport
from app.services.report_service import ReportService
from typing import Optional

router = APIRouter(prefix="/reports", tags=["reports"])

@router.get("/daily")
def get_daily_report(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    client_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get daily usage report"""
    service = ReportService(db)
    return service.get_daily_report(start_date, end_date, client_id)

@router.get("/monthly")
def get_monthly_report(
    year: int = Query(default=datetime.now().year),
    month: int = Query(default=datetime.now().month),
    client_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get monthly consumption report"""
    service = ReportService(db)
    return service.get_monthly_report(year, month, client_id)

@router.get("/summary")
def get_usage_summary(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    client_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get usage summary"""
    service = ReportService(db)
    return service.get_summary(start_date, end_date, client_id)
```

### Step 4: Service Layer

**File: `app/services/report_service.py`**
```python
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import date, datetime, timedelta
from typing import Optional, List, Dict, Any
from app.models.client import Client
from app.models.api_request import ApiRequest
from app.models.report import UsageReport

class ReportService:
    def __init__(self, db: Session):
        self.db = db
    
    def get_daily_report(
        self, 
        start_date: Optional[date] = None, 
        end_date: Optional[date] = None,
        client_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Generate daily usage report"""
        if not start_date:
            start_date = date.today() - timedelta(days=30)
        if not end_date:
            end_date = date.today()
        
        # Build query
        query = self.db.query(
            func.date(ApiRequest.request_time).label('date'),
            func.count(ApiRequest.id).label('total_requests'),
            func.sum(
                func.case(
                    [(ApiRequest.response_status == 'success', 1)], else_=0
                )
            ).label('success_count'),
            func.sum(
                func.case(
                    [(ApiRequest.response_status == 'failed', 1)], else_=0
                )
            ).label('failed_count'),
            func.sum(
                func.case(
                    [(ApiRequest.response_status == 'not_found', 1)], else_=0
                )
            ).label('not_found_count'),
            func.avg(ApiRequest.response_time).label('avg_response_time')
        ).filter(
            func.date(ApiRequest.request_time).between(start_date, end_date)
        ).group_by(
            func.date(ApiRequest.request_time)
        ).order_by('date')
        
        if client_id:
            query = query.filter(ApiRequest.client_id == client_id)
        
        results = query.all()
        
        return [
            {
                'date': str(result.date),
                'total_requests': result.total_requests or 0,
                'success_requests': result.success_count or 0,
                'failed_requests': result.failed_count or 0,
                'not_found_requests': result.not_found_count or 0,
                'avg_response_time': float(result.avg_response_time or 0)
            }
            for result in results
        ]
    
    def get_monthly_report(
        self, 
        year: int, 
        month: int,
        client_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Generate monthly consumption report"""
        # Get total requests
        query = self.db.query(
            func.count(ApiRequest.id).label('total_requests'),
            func.sum(
                func.case(
                    [(ApiRequest.response_status == 'success', 1)], else_=0
                )
            ).label('success_requests'),
            func.sum(
                func.case(
                    [(ApiRequest.response_status == 'failed', 1)], else_=0
                )
            ).label('failed_requests')
        ).filter(
            extract('year', ApiRequest.request_time) == year,
            extract('month', ApiRequest.request_time) == month
        )
        
        if client_id:
            query = query.filter(ApiRequest.client_id == client_id)
        
        result = query.first()
        
        return {
            'month': datetime(year, month, 1).strftime('%B'),
            'year': year,
            'total_requests': result.total_requests or 0,
            'success_requests': result.success_requests or 0,
            'failed_requests': result.failed_requests or 0,
            'not_found_requests': (result.total_requests or 0) - (result.success_requests or 0) - (result.failed_requests or 0)
        }
```

---

## Testing

### 1. Unit Tests
**File: `tests/test_report_service.py`**
```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.services.report_service import ReportService

# Test database
TEST_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(bind=engine)

@pytest.fixture
def db():
    Base.metadata.create_all(bind=engine)
    yield TestingSessionLocal()
    Base.metadata.drop_all(bind=engine)

def test_get_daily_report(db):
    service = ReportService(db)
    result = service.get_daily_report()
    assert isinstance(result, list)
    assert len(result) >= 0  # May be empty

def test_get_monthly_report(db):
    service = ReportService(db)
    result = service.get_monthly_report(2024, 1)
    assert 'month' in result
    assert 'year' in result
    assert result['month'] == 'January'
```

### 2. Integration Tests
**File: `tests/test_api.py`**
```python
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_login():
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "test@example.com", "password": "testpass123"}
    )
    assert response.status_code == 200
    assert "access_token" in response.json()

def test_get_daily_report():
    # First login
    login_response = client.post(
        "/api/v1/auth/login",
        data={"username": "admin@example.com", "password": "admin123"}
    )
    token = login_response.json()["access_token"]
    
    # Then get report
    response = client.get(
        "/api/v1/reports/daily",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)
```

### 3. Run Tests
```bash
# Run all tests
pytest -v

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_report_service.py -v
```

---

## Frontend Integration

### 1. Update Environment Variables
**File: `.env.development`**
```env
VITE_API_BASE_URL=http://localhost:8000
VITE_USE_MOCK_DATA=false
```

**File: `.env.production`**
```env
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_USE_MOCK_DATA=false
```

### 2. Update API Client
**File: `src/services/apiClient.ts`**
```typescript
// Replace localStorage calls with actual API calls

export const apiClient = {
  async getDailyReport(filters: ReportFilters): Promise<DailyReport[]> {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL}/api/v1/reports/daily?start_date=${filters.startDate}&end_date=${filters.endDate}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    if (!response.ok) throw new Error('Failed to fetch daily report');
    return response.json();
  },
  
  async getMonthlyReport(year: number, month: number): Promise<MonthlyReport> {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL}/api/v1/reports/monthly?year=${year}&month=${month}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    if (!response.ok) throw new Error('Failed to fetch monthly report');
    return response.json();
  }
};
```

### 3. Update Report Service
**File: `src/services/reportService.ts`**
```typescript
export const reportService = {
  getDailyReport(filters: ReportFilters, clientId?: string): DailyUsageReport[] {
    // Replace localStorage logic with API call
    return apiClient.getDailyReport(filters, clientId);
  },
  
  getMonthlyReport(filters: ReportFilters, clientId?: string): MonthlyConsumptionReport {
    // Replace localStorage logic with API call
    return apiClient.getMonthlyReport(filters, clientId);
  }
};
```

---

## Deployment

### 1. Production Database Setup
```bash
# Create database
sudo -u postgres psql
CREATE DATABASE vehicle_api_db;
CREATE USER vehicle_api_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE vehicle_api_db TO vehicle_api_user;
```

### 2. Run Migrations
```bash
alembic upgrade head
```

### 3. Start Server
```bash
# Development
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Production
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### 4. Docker Deployment
**File: `Dockerfile`**
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY ./app ./app

# Run migrations
RUN alembic upgrade head

# Expose port
EXPOSE 8000

# Start server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**File: `docker-compose.yml`**
```yaml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: vehicle_api_db
      POSTGRES_USER: vehicle_api_user
      POSTGRES_PASSWORD: secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://vehicle_api_user:secure_password@db:5432/vehicle_api_db
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - db
      - redis
    volumes:
      - ./app:/app/app

volumes:
  postgres_data:
```

### 5. Nginx Configuration
**File: `/etc/nginx/sites-available/vehicle-api`**
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Performance Optimization

### 1. Database Indexes
```sql
CREATE INDEX idx_api_requests_client_time ON api_requests(client_id, request_time);
CREATE INDEX idx_api_requests_status ON api_requests(response_status);
CREATE INDEX idx_usage_reports_date ON usage_reports(report_date);
CREATE INDEX idx_client_api_access_client ON client_api_access(client_id);
```

### 2. Caching Strategy
```python
from redis import Redis
from functools import wraps

redis = Redis.from_url(settings.REDIS_URL)

def cache_response(expire=300):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            cache_key = f"{func.__name__}:{str(args)}:{str(kwargs)}"
            cached = redis.get(cache_key)
            if cached:
                return json.loads(cached)
            
            result = await func(*args, **kwargs)
            redis.setex(cache_key, expire, json.dumps(result))
            return result
        return wrapper
    return decorator

# Usage
@cache_response(expire=600)
def get_daily_report(...):
    ...
```

### 3. Pagination
```python
@router.get("/api-requests")
def get_requests(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    offset = (page - 1) * page_size
    total = db.query(ApiRequest).count()
    requests = db.query(ApiRequest).offset(offset).limit(page_size).all()
    
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "data": requests
    }
```

---

## Security Considerations

### 1. Authentication
- Use JWT tokens with expiration
- Implement refresh token mechanism
- Hash passwords with bcrypt (cost factor 12+)

### 2. Authorization
- Role-based access control (admin/client)
- Verify client ownership before returning data
- Rate limiting per client

### 3. Data Protection
- Use HTTPS in production
- Sanitize all inputs
- Implement CORS properly
- Regular security audits

---

## Monitoring & Maintenance

### 1. Health Check Endpoint
```python
@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": settings.VERSION
    }
```

### 2. Database Backup
```bash
# Automated daily backup
0 2 * * * /usr/bin/pg_dump -U vehicle_api_user vehicle_api_db > backup_$(date +\%Y\%m\%d).sql
```

### 3. Logging
```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# Usage
logger.info(f"API request tracked: {request_id}")
```

---

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Check DATABASE_URL in .env
   - Verify PostgreSQL is running
   - Check firewall rules

2. **CORS Errors**
   - Update CORS_ORIGINS in .env
   - Verify frontend URL matches

3. **Slow Queries**
   - Add database indexes
   - Enable query logging
   - Use EXPLAIN ANALYZE

4. **Token Expiration**
   - Implement refresh token flow
   - Adjust ACCESS_TOKEN_EXPIRE_MINUTES

---

## Next Steps

1. **Phase 1**: Core API (Authentication, Client Management, Request Tracking)
2. **Phase 2**: Reports & Analytics (Daily/Monthly reports, Charts data)
3. **Phase 3**: Advanced Features (Invoice generation, Export functionality)
4. **Phase 4**: Testing & Optimization (Load testing, Caching, Monitoring)

---

## Support

For issues or questions:
- Check logs: `docker logs backend`
- Database queries: Enable SQLAlchemy echo mode
- API testing: Use `/docs` endpoint (FastAPI auto-generated docs)

**Estimated Implementation Time**: 2-3 weeks for complete backend with testing