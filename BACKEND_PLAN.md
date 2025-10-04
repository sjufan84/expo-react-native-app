# LiveKit Agent Backend Development & Deployment Plan

## 1. Project Overview

This document outlines the development and deployment plan for a new LiveKit Voice AI Agent. The agent will serve as the backend for the BakeBot mobile application, enabling real-time voice and text interactions. This plan is designed for an AI engineering team to implement.

## 2. Agent Core Framework

-   **Framework**: The agent will be built using the **LiveKit Agents Framework for Python**. This provides a robust foundation for creating voice AI agents with STT, LLM, and TTS pipelines.
-   **Reference**: [LiveKit Agents Introduction](https://docs.livekit.io/agents.md)

## 3. Development Environment Setup

-   **Language**: Python 3.10+
-   **Initial Setup**:
    1.  Create a new Python project directory.
    2.  Initialize a virtual environment (`python -m venv .venv`).
    3.  Install the LiveKit Agents SDK: `pip install livekit-agents`.
    4.  Follow the **Voice AI Quickstart** to build a baseline agent. This will serve as the foundation for our custom agent.
-   **Reference**: [Voice AI Quickstart](https://docs.livekit.io/agents/start/voice-ai.md)

## 4. Agent Implementation Details

The agent must handle both text and voice input from the frontend.

### 4.1. Agent Entrypoint & Worker

-   The agent will be managed by a `Worker`. The worker will listen for new rooms and assign an agent to handle the session.
-   The agent's lifecycle will be tied to a user's session in a LiveKit room.
-   **Reference**: [Worker Lifecycle](https://docs.livekit.io/agents/worker.md)

### 4.2. Voice Pipeline (STT, LLM, TTS)

-   **Speech-to-Text (STT)**: Use a provider like **Deepgram** or **OpenAI Whisper** for real-time transcription.
-   **Large Language Model (LLM)**: Use a model like **OpenAI's GPT-4o** or **Google's Gemini** for conversational logic. The LLM will process the transcribed text and generate responses.
-   **Text-to-Speech (TTS)**: Use a provider like **ElevenLabs** or **OpenAI TTS** for generating natural-sounding voice responses.
-   The agent should be configured to handle interruptions and manage conversation turns effectively.
-   **References**:
    -   [Building Voice Agents](https://docs.livekit.io/agents/build.md)
    -   [Choosing Models](https://docs.livekit.io/agents/models.md)

### 4.3. Data Channel Communication

-   In addition to voice, the agent must communicate over the data channel to handle text messages and other events from the frontend (like receiving image data).
-   The agent will need to be able to receive `DataChannelMessage` objects and send back responses in the same format. The frontend currently sends messages with types like `text` and `image`. The agent should be programmed to handle these.

## 5. Deployment to LiveKit Cloud

-   **Deployment Target**: The agent will be deployed to **LiveKit Cloud**. This simplifies infrastructure management.
-   **Steps**:
    1.  **Containerize the Agent**: Create a `Dockerfile` for the Python agent application. The documentation provides templates.
    2.  **Manage Secrets**: Use the LiveKit Cloud dashboard or CLI to manage API keys for STT, LLM, and TTS services.
    3.  **Deploy using LiveKit CLI**: Use the `livekit-cli deploy-agent` command to build and deploy the agent to LiveKit Cloud.
-   **References**:
    -   [Deploying to LiveKit Cloud](https://docs.livekit.io/agents/ops/deployment.md)
    -   [CLI Reference](https://docs.livekit.io/agents/ops/deployment/cli.md)
    -   [Builds and Dockerfiles](https://docs.livekit.io/agents/ops/deployment/builds.md)

## 6. Frontend Integration Notes

The existing frontend is well-structured but requires modifications to fully support the new voice agent.

### 6.1. Token Generation

-   A secure backend service (e.g., a serverless function) must be created to generate LiveKit access tokens for users. The token must grant the user `participant` permissions and should include the user's identity.
-   The frontend `useLiveKit` hook's `connect` method will need to fetch this token from the new backend service instead of receiving it as a direct argument (or using a mock).
-   **Reference**: [Generating Access Tokens](https://docs.livekit.io/home/server/generating-tokens.md)

### 6.2. Voice Session Management

-   The placeholder functions `startVoiceRecording` and `stopVoiceRecording` in `AgentContext.tsx` must be implemented.
-   These functions will interact with the `LiveKitService` to:
    -   Publish the user's local audio track when a voice session starts.
    -   Mute/unmute the audio track for push-to-talk functionality.
    -   Stop publishing the audio track when the voice session ends.
-   **Reference**: [Publishing Camera & Microphone](https://docs.livekit.io/home/client/tracks/publish.md)

### 6.3. Handling Agent Events

-   The `LiveKitService` needs to be updated to handle incoming audio tracks from the agent and play them.
-   Event listeners in `LiveKitService` should be enhanced to properly handle agent-specific events (e.g., agent joining/leaving, agent starting to speak).

## 7. Next Steps

1.  **AI Engineering Team**: Begin with the **Voice AI Quickstart** to create the initial agent.
2.  **Frontend Team**: Implement the token generation service and update the frontend to fetch tokens.
3.  **AI Engineering Team**: Implement the full voice pipeline and data channel logic for the agent.
4.  **AI Engineering Team**: Create the `Dockerfile` and deploy a test version of the agent to LiveKit Cloud.
5.  **Integration**: Connect the frontend to the deployed agent and conduct end-to-end testing.