#!/usr/bin/env python3
"""
Test script for BakeBot Agent
Used for local testing and development
"""

import asyncio
import json
import logging
import os
import uuid
from datetime import datetime

# Mock LiveKit components for testing
class MockRoom:
    def __init__(self):
        self.name = "test-room"
        self.remote_participants = {}
        self.local_participant = MockLocalParticipant()

    async def connect(self, url, token, auto_subscribe=None):
        print(f"✅ Connected to mock room: {self.name}")

class MockLocalParticipant:
    async def publish_data(self, data, kind):
        print(f"📤 Published data: {len(data)} bytes")

class MockRemoteParticipant:
    def __init__(self, identity="test-user"):
        self.identity = identity

class MockJobContext:
    def __init__(self):
        self.room = MockRoom()

async def test_text_message(agent):
    """Test text message handling"""
    print("\n🧪 Testing text message...")

    # Simulate text message
    message = {
        "type": "text",
        "payload": {"content": "How do I make perfect scrambled eggs?"},
        "timestamp": datetime.now().timestamp(),
        "message_id": str(uuid.uuid4())
    }

    # Convert to DataChannelMessage format
    from models.schemas import DataChannelMessage
    data_message = DataChannelMessage(**message)

    # Handle the message
    await agent._handle_text_message(data_message)
    print("✅ Text message test completed")

async def test_image_message(agent):
    """Test image message handling"""
    print("\n🧪 Testing image message...")

    # Small base64 test image (1x1 pixel red dot)
    test_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

    message = {
        "type": "image",
        "payload": {
            "data": test_image,
            "caption": "Is this done cooking?"
        },
        "timestamp": datetime.now().timestamp(),
        "message_id": str(uuid.uuid4())
    }

    # Convert to DataChannelMessage format
    from models.schemas import DataChannelMessage
    data_message = DataChannelMessage(**message)

    # Handle the message
    await agent._handle_image_message(data_message)
    print("✅ Image message test completed")

async def test_session_control(agent):
    """Test session control messages"""
    print("\n🧪 Testing session control...")

    # Start session
    message = {
        "type": "control",
        "payload": {
            "action": "start_session",
            "session_type": "text",
            "user_id": "test-user-123"
        },
        "timestamp": datetime.now().timestamp(),
        "message_id": str(uuid.uuid4())
    }

    from models.schemas import DataChannelMessage
    data_message = DataChannelMessage(**message)
    await agent._handle_control_message(data_message)

    # End session
    message["payload"]["action"] = "end_session"
    data_message = DataChannelMessage(**message)
    await agent._handle_control_message(data_message)

    print("✅ Session control test completed")

async def main():
    """Main test function"""
    print("🚀 Starting BakeBot Agent Tests")
    print("=" * 50)

    # Check environment variables
    required_vars = ['GOOGLE_API_KEY']
    missing_vars = [var for var in required_vars if not os.getenv(var)]

    if missing_vars:
        print(f"❌ Missing environment variables: {missing_vars}")
        print("Please set up your .env file with proper API keys")
        return

    try:
        # Import and initialize agent
        from agent.bakebot_agent import BakeBotAgent
        from services.google_ai_service import GoogleAIService
        from services.speech_service import SpeechService

        print("✅ Agent imports successful")

        # Initialize services
        ai_service = GoogleAIService()
        speech_service = SpeechService()

        print("✅ Services initialized")

        # Create mock context
        mock_ctx = MockJobContext()

        # Create agent
        agent = BakeBotAgent()
        agent.ctx = mock_ctx
        agent.room = mock_ctx.room
        agent.participant = MockRemoteParticipant()
        agent.ai_service = ai_service
        agent.speech_service = speech_service

        print("✅ Agent initialized")

        # Run tests
        await test_text_message(agent)
        await test_image_message(agent)
        await test_session_control(agent)

        print("\n" + "=" * 50)
        print("🎉 All tests completed successfully!")

        # Test AI service directly
        print("\n🧪 Testing AI service directly...")
        response = await ai_service.generate_text_response("What temperature should chicken be cooked to?")
        print(f"📝 AI Response: {response[:100]}...")

    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())