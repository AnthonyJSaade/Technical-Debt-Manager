.PHONY: dev backend frontend install-backend install-frontend install

# Run both backend and frontend concurrently
dev:
	@echo "Starting RepoVision development servers..."
	@make -j2 backend frontend

# Run the FastAPI backend server
backend:
	@echo "Starting Backend on http://localhost:8000"
	cd backend && python -m uvicorn app.main:app --reload --port 8000

# Run the Vite frontend dev server
frontend:
	@echo "Starting Frontend on http://localhost:5173"
	cd frontend && npm run dev

# Install backend dependencies
install-backend:
	cd backend && pip install -r requirements.txt

# Install frontend dependencies
install-frontend:
	cd frontend && npm install

# Install all dependencies
install: install-backend install-frontend

