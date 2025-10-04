import asyncio
import json
import logging
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any

from livekit import rtc
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    JobProcess,
    WorkerOptions,
    cli,
    llm,
    stt,
    tts,
    vad,
)
from livekit.agents.llm import ChatContext, ChatMessage
from livekit.agents.voice_assistant import VoiceAssistant

from models.schemas import (
    DataChannelMessage,
    MessageType,
    SessionType,
    SessionConfig,
    AgentResponse
)
from services.google_ai_service import GoogleAIService
from services.speech_service import SpeechService

logger = logging.getLogger(__name__)

class BakeBotAgent:
    """BakeBot - Virtual Sous Chef AI Agent"""

    def __init__(self):
        self.ctx: Optional[JobContext] = None
        self.room: Optional[rtc.Room] = None
        self.participant: Optional[rtc.RemoteParticipant] = None

        # Services
        self.ai_service = GoogleAIService()
        self.speech_service = SpeechService()

        # Session state
        self.session_config: Optional[SessionConfig] = None
        self.conversation_history: List[Dict[str, str]] = []
        self.current_session_id: str = str(uuid.uuid4())

        # Voice assistant
        self.voice_assistant: Optional[VoiceAssistant] = None

        # Data channel
        self.data_channel: Optional[rtc.DataChannel] = None

        logger.info("BakeBot agent initialized")

    async def start(self, ctx: JobContext):
        """Start the agent."""
        self.ctx = ctx
        self.room = ctx.room

        logger.info(f"Starting BakeBot agent for room: {self.room.name}")

        try:
            # Configure room
            await self._setup_room()

            # Setup voice assistant
            await self._setup_voice_assistant()

            # Setup data channel listeners
            await self._setup_data_channel()

            # Connect to participant
            await self._connect_to_participant()

            logger.info("BakeBot agent started successfully")

        except Exception as e:
            logger.error(f"Error starting agent: {e}")
            raise

    async def cleanup(self):
        """Clean up agent resources."""
        logger.info("Cleaning up BakeBot agent")

        if self.voice_assistant:
            await self.voice_assistant.stop()

        if self.data_channel:
            self.data_channel = None

        # Clear conversation history
        self.conversation_history.clear()

        logger.info("BakeBot agent cleaned up")

    async def _setup_room(self):
        """Setup the LiveKit room."""
        # Connect to room
        await self.room.connect(
            url=self.ctx.room.url,
            token=self.ctx.room.token,
            auto_subscribe=AutoSubscribe.AUDIO_ONLY
        )

        logger.info(f"Connected to room: {self.room.name}")

    async def _setup_voice_assistant(self):
        """Setup the voice assistant."""
        # Create fnc for TTS using our speech service
        async def bakebot_tts(text: str) -> rtc.AudioFrame:
            audio_bytes = await self.speech_service.synthesize_speech(text)
            # Convert bytes to AudioFrame
            return rtc.AudioFrame(
                data=audio_bytes,
                sample_rate=16000,
                num_channels=1,
                samples_per_channel=len(audio_bytes) // 2  # 16-bit audio
            )

        # Create fnc for STT using our speech service
        async def bakebot_stt(audio_frame: rtc.AudioFrame) -> str:
            # Convert AudioFrame to bytes for STT
            audio_bytes = audio_frame.data.tobytes()
            return await self.speech_service.transcribe_audio_stream([audio_bytes])

        # Create voice assistant
        self.voice_assistant = VoiceAssistant(
            vad=vad.VAD(),
            stt=stt.StreamAdapter(stt=bakebot_stt),
            llm=self._create_llm_adapter(),
            tts=tts.StreamAdapter(tts=bakebot_tts),
            chat_ctx=self._create_chat_context()
        )

        # Start voice assistant
        self.voice_assistant.start(self.room)

    async def _setup_data_channel(self):
        """Setup data channel for text and image communication."""
        @self.room.on("data_received")
        def on_data_received(data: bytes, participant: rtc.RemoteParticipant, kind: rtc.DataPacketKind):
            asyncio.create_task(self._handle_data_message(data, participant))

    async def _connect_to_participant(self):
        """Connect to the first participant in the room."""
        participants = list(self.room.remote_participants.values())
        if participants:
            self.participant = participants[0]
            logger.info(f"Connected to participant: {self.participant.identity}")

            # Send welcome message
            await self._send_message(
                content="Hi! I'm BakeBot, your virtual sous chef! How can I help you in the kitchen today?",
                message_type="text"
            )

    async def _handle_data_message(self, data: bytes, participant: rtc.RemoteParticipant):
        """Handle incoming data channel messages."""
        try:
            # Parse the message
            message_dict = json.loads(data.decode('utf-8'))
            message = DataChannelMessage(**message_dict)

            logger.info(f"Received {message.type} message from {participant.identity}")

            if message.type == MessageType.TEXT:
                await self._handle_text_message(message)

            elif message.type == MessageType.IMAGE:
                await self._handle_image_message(message)

            elif message.type == MessageType.CONTROL:
                await self._handle_control_message(message)

        except Exception as e:
            logger.error(f"Error handling data message: {e}")

    async def _handle_text_message(self, message: DataChannelMessage):
        """Handle text messages."""
        content = message.payload.get('content', '')
        if not content:
            return

        # Add to conversation history
        self.conversation_history.append({
            "sender": "user",
            "content": content,
            "timestamp": message.timestamp
        })

        # Generate response
        response_text = await self.ai_service.generate_text_response(
            content, self.conversation_history[:-1]
        )

        # Add response to history
        self.conversation_history.append({
            "sender": "agent",
            "content": response_text,
            "timestamp": datetime.now().timestamp()
        })

        # Send response
        await self._send_message(
            content=response_text,
            message_type="text"
        )

        # If voice assistant is available, also speak the response
        if self.voice_assistant and self.session_config:
            if self.session_config.session_type == SessionType.VOICE_PTT or \
               self.session_config.session_type == SessionType.VOICE_VAD:
                await self.voice_assistant.say(response_text)

    async def _handle_image_message(self, message: DataChannelMessage):
        """Handle image messages."""
        image_data = message.payload.get('data', '')
        caption = message.payload.get('caption', '')

        if not image_data:
            return

        # Add to conversation history
        self.conversation_history.append({
            "sender": "user",
            "content": f"[Image] {caption}" if caption else "[Image]",
            "timestamp": message.timestamp
        })

        # Generate response based on image
        response_text = await self.ai_service.analyze_image(
            image_data, caption
        )

        # Add response to history
        self.conversation_history.append({
            "sender": "agent",
            "content": response_text,
            "timestamp": datetime.now().timestamp()
        })

        # Send response
        await self._send_message(
            content=response_text,
            message_type="text"
        )

    async def _handle_control_message(self, message: DataChannelMessage):
        """Handle control messages for session management."""
        payload = message.payload

        if payload.get('action') == 'start_session':
            session_type = payload.get('session_type', 'text')
            voice_mode = payload.get('voice_mode')

            self.session_config = SessionConfig(
                session_type=SessionType(session_type),
                voice_mode=voice_mode,
                user_id=payload.get('user_id', 'unknown'),
                turn_detection=payload.get('turn_detection', 'auto')
            )

            logger.info(f"Started session: {self.session_config.session_type}")

            # Send confirmation
            await self._send_message(
                content="Session started! I'm ready to help.",
                message_type="control",
                payload={"status": "session_started"}
            )

        elif payload.get('action') == 'end_session':
            logger.info("Session ended")
            self.session_config = None

            # Send confirmation
            await self._send_message(
                content="Session ended. Feel free to start a new one anytime!",
                message_type="control",
                payload={"status": "session_ended"}
            )

    async def _send_message(self, content: str, message_type: str, payload: Dict[str, Any] = None):
        """Send a message via data channel."""
        if not self.participant:
            return

        message = DataChannelMessage(
            type=MessageType(message_type),
            payload=payload or {"content": content},
            timestamp=datetime.now().timestamp(),
            message_id=str(uuid.uuid4())
        )

        # Send via data channel
        data = json.dumps(message.dict()).encode('utf-8')
        await self.room.local_participant.publish_data(data, kind=rtc.DataPacketKind.RELIABLE)

        logger.info(f"Sent {message_type} message")

    def _create_chat_context(self) -> ChatContext:
        """Create initial chat context."""
        ctx = ChatContext()
        ctx.append_message(
            role="system",
            content="You are BakeBot, a friendly and knowledgeable virtual sous chef."
        )
        return ctx

    def _create_llm_adapter(self):
        """Create LLM adapter for voice assistant."""
        class BakeBotLLMAdapter:
            def __init__(self, ai_service):
                self.ai_service = ai_service

            async def chat(self, messages: List[ChatMessage]) -> str:
                # Convert messages to conversation history format
                conversation_history = []
                for msg in messages:
                    if msg.role == "user":
                        conversation_history.append({
                            "sender": "user",
                            "content": msg.content
                        })
                    elif msg.role == "assistant":
                        conversation_history.append({
                            "sender": "agent",
                            "content": msg.content
                        })

                # Get the last user message
                last_message = ""
                for msg in reversed(messages):
                    if msg.role == "user":
                        last_message = msg.content
                        break

                # Generate response
                return await self.ai_service.generate_voice_response(
                    last_message, conversation_history[:-1]
                )

        return BakeBotLLMAdapter(self.ai_service)