# BakeBot LiveKit Agent

A Voice AI Agent built with LiveKit Agents Framework that serves as the backend for the BakeBot mobile application.

## Features

- Real-time voice communication using LiveKit
- Multimodal support (voice, text, images)
- Google AI integration for conversation and vision
- Voice Activity Detection (VAD)
- Session management
- Error handling and reconnection

## Setup

1. Create and activate virtual environment:
```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your API keys
```

## Running Locally

```bash
python main.py
```

## Deployment

Deploy to LiveKit Cloud using:
```bash
livekit-cli deploy-agent
```

## Architecture

- `main.py` - Agent entry point and worker setup
- `agent/` - Core agent implementation
- `services/` - External service integrations (Google AI, STT, TTS)
- `models/` - Data models and types
- `utils/` - Utility functions