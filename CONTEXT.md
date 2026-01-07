# RepoVision - Project Context
**Current Phase:** MVP Complete (Version 0.1)

## Architecture Decisions
- **Brain:** Groq (Llama 3 70B) via OpenAI Client.
- **Body:** Docker SDK (`python:3.11-slim` containers).
- **Eyes:** Tree-sitter (Python AST parsing).
- **Memory:** SQLite (`repo.db`) + SQLModel.
- **UI:** React Flow + Custom "Fix Modal".

## Completed Features
- [x] Recursive Project Scanner (`POST /scan`).
- [x] Code Analysis & Complexity Scoring.
- [x] The Janitor Agent (State Machine: Repro -> Fix -> Verify).
- [x] Sandbox Safety (Docker isolation).
- [x] Frontend Integration (Click Node -> Fix -> Apply).

## Next Steps (Backlog)
- [ ] **The Historian Agent:** Analyze `git blame` to explain legacy context.
- [ ] **Multi-File Context:** Allow the agent to see imported files, not just the target file.
- [ ] **Polishing:** Better loading states and error handling in UI.
