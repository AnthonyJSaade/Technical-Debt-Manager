# RepoVision: The Self-Healing Codebase
**Tagline:** An AI-Powered Mission Control for Technical Debt.

## Core Concept
RepoVision is a local-first tool that helps developers understand and fix legacy code.
It combines a "Google Maps for Code" (visualizing architecture) with an autonomous "Janitor Agent" (fixing bugs).

## The 3 Pillars
1. **The Health HUD:** A dashboard tracking Debt Score, Rot Rate, and Test Coverage.
2. **The Visualizer:** A Layered Flow Map (using React Flow) showing how data moves (Frontend -> API -> DB).
3. **The Janitor (TDD Agent):** An autonomous agent that follows a strict loop:
   - Probe (Write failing test) -> Fix (Refactor code) -> Verify (Pass test).

## Technical Architecture (MVP)
- **Backend:** Python (FastAPI).
- **Frontend:** React + TypeScript + React Flow + Tailwind.
- **Database:** SQLite (Stores dependency graph and metric history).
- **Analysis:** Tree-sitter (Parses Python code into ASTs).
- **Execution:** Docker SDK (Sandboxed environment for the Janitor Agent)


# //


# RepoVision 🧠

**An AI-Powered Mission Control for Technical Debt.**

RepoVision is an Agentic IDE tool that visualizes codebase complexity, identifies architectural hotspots, and autonomously fixes bugs using **Claude 3 Opus**.

## 📸 Screenshots
![Dashboard Preview](path/to/dashboard_screenshot.png)

## 🚀 Features
* **Cognitive Complexity Analysis:** Uses Tree-sitter to calculate "Nesting Depth" penalties, not just Cyclomatic Complexity.
* **Visual Blueprint:** Interactive System Explorer layout to visualize dependencies.
* **Janitor Agent:** An autonomous AI agent that reproduces bugs, writes tests, and fixes code.
* **Safe Mode:** Review fixes in a side-by-side diff before applying or downloading them.

## 🛠️ Tech Stack
* **Backend:** Python, FastAPI, Tree-sitter, Anthropic API (Claude 3 Opus).
* **Frontend:** React, TypeScript, Tailwind CSS.
* **Architecture:** Agentic Workflow (Diagnosis -> Plan -> Fix -> Verify).

## ⚡ Quick Start
1. Clone the repo.
2. `cd backend && pip install -r requirements.txt`
3. `cd frontend && npm install`
4. Set up `.env` with `ANTHROPIC_API_KEY`.
