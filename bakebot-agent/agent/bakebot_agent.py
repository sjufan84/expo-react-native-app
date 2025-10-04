import asyncio
import json
import logging
import uuid
import time
from datetime import datetime
from typing import Optional, List, Dict, Any

from livekit import rtc
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    vad,
)
from livekit.agents.llm import ChatContext, ChatMessage
from livekit.agents.voice_assistant import VoiceAssistant

from models.schemas import (
    DataChannelMessage,
    MessageType,
    SessionType,
    SessionConfig,
)
from services.google_ai_service import GoogleAIService
from services.speech_service import SpeechService, GoogleStreamSTT, GoogleStreamTTS

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

        # Performance monitoring
        self._performance_metrics = {
            "stt_latency": [],
            "tts_latency": [],
            "llm_latency": [],
            "total_roundtrip": [],
        }

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
            auto_subscribe=AutoSubscribe.AUDIO_ONLY,
        )

        logger.info(f"Connected to room: {self.room.name}")

    async def _setup_voice_assistant(self):
        """Setup the voice assistant with proper streaming support."""
        # Create streaming STT adapter
        stream_stt = GoogleStreamSTT()

        # Create streaming TTS adapter
        stream_tts = GoogleStreamTTS()

        # Create VAD with proper configuration for low latency
        vad_instance = vad.VAD(
            min_speech_duration=0.3,  # 300ms minimum speech
            min_silence_duration=0.8,  # 800ms silence before end
            padding_duration=0.1,      # 100ms padding
            threshold=0.5,            # Moderate sensitivity
        )

        # Create voice assistant with proper streaming adapters
        self.voice_assistant = VoiceAssistant(
            vad=vad_instance,
            stt=stream_stt,
            llm=self._create_llm_adapter(),
            tts=stream_tts,
            chat_ctx=self._create_chat_context(),
            # Enable barge-in for better user experience
            allow_barge_in=True,
            # Configure turn detection based on session type
            turn_detection=vad.VAD.TurnDetection.SERVER_SIDE,
        )

        # Start voice assistant
        self.voice_assistant.start(self.room)

        # Setup event handlers for monitoring
        self._setup_voice_assistant_events()

        logger.info("Voice assistant started with streaming STT/TTS")

    def _setup_voice_assistant_events(self):
        """Setup event handlers for voice assistant monitoring."""
        if not self.voice_assistant:
            return

        @self.voice_assistant.on("user_started_speaking")
        def on_user_started_speaking():
            logger.info("User started speaking")
            # Record start time for latency measurement
            self._speech_start_time = time.time()

        @self.voice_assistant.on("user_stopped_speaking")
        def on_user_stopped_speaking():
            logger.info("User stopped speaking")

        @self.voice_assistant.on("agent_started_speaking")
        def on_agent_started_speaking():
            logger.info("Agent started speaking")
            # Calculate STT + LLM latency
            if hasattr(self, "_speech_start_time"):
                stt_llm_latency = (time.time() - self._speech_start_time) * 1000
                self._performance_metrics["stt_latency"].append(stt_llm_latency)
                logger.info(f"STT + LLM latency: {stt_llm_latency:.2f}ms")

        @self.voice_assistant.on("agent_stopped_speaking")
        def on_agent_stopped_speaking():
            logger.info("Agent stopped speaking")
            # Calculate total roundtrip latency
            if hasattr(self, "_speech_start_time"):
                total_latency = (time.time() - self._speech_start_time) * 1000
                self._performance_metrics["total_roundtrip"].append(total_latency)

                # Log performance metrics
                avg_total = sum(self._performance_metrics["total_roundtrip"]) / len(self._performance_metrics["total_roundtrip"])
                logger.info(f"Total roundtrip latency: {total_latency:.2f}ms (avg: {avg_total:.2f}ms)")

                # Alert if exceeding target
                if total_latency > 500:
                    logger.warning(f"Latency target exceeded! {total_latency:.2f}ms > 500ms")

        @self.voice_assistant.on("speech_interrupted")
        def on_speech_interrupted():
            logger.info("Speech was interrupted (barge-in)")

        @self.voice_assistant.on("error")
        def on_error(error: Exception):
            logger.error(f"Voice assistant error: {error}")

        logger.info("Voice assistant event handlers configured")

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
                message_type="text",
            )

    async def _handle_data_message(self, data: bytes, participant: rtc.RemoteParticipant):
        """Handle incoming data channel messages."""
        try:
            # Parse the message
            message_dict = json.loads(data.decode("utf-8"))
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
        content = message.payload.get("content", "")
        if not content:
            return

        # Add to conversation history
        self.conversation_history.append({
            "sender": "user",
            "content": content,
            "timestamp": message.timestamp,
        })

        # Generate response
        response_text = await self.ai_service.generate_text_response(
            content, self.conversation_history[:-1],
        )

        # Add response to history
        self.conversation_history.append({
            "sender": "agent",
            "content": response_text,
            "timestamp": datetime.now().timestamp(),
        })

        # Send response
        await self._send_message(
            content=response_text,
            message_type="text",
        )

        # If voice assistant is available, also speak the response
        if self.voice_assistant and self.session_config:
            if self.session_config.session_type == SessionType.VOICE_PTT or \
               self.session_config.session_type == SessionType.VOICE_VAD:
                await self.voice_assistant.say(response_text)

    async def _handle_image_message(self, message: DataChannelMessage):
        """Handle image messages."""
        image_data = message.payload.get("data", "")
        caption = message.payload.get("caption", "")

        if not image_data:
            return

        # Add to conversation history
        self.conversation_history.append({
            "sender": "user",
            "content": f"[Image] {caption}" if caption else "[Image]",
            "timestamp": message.timestamp,
        })

        # Generate response based on image
        response_text = await self.ai_service.analyze_image(
            image_data, caption,
        )

        # Add response to history
        self.conversation_history.append({
            "sender": "agent",
            "content": response_text,
            "timestamp": datetime.now().timestamp(),
        })

        # Send response
        await self._send_message(
            content=response_text,
            message_type="text",
        )

    async def _handle_control_message(self, message: DataChannelMessage):
        """Handle control messages for session management."""
        payload = message.payload

        if payload.get("action") == "start_session":
            session_type = payload.get("session_type", "text")
            voice_mode = payload.get("voice_mode")

            self.session_config = SessionConfig(
                session_type=SessionType(session_type),
                voice_mode=voice_mode,
                user_id=payload.get("user_id", "unknown"),
                turn_detection=payload.get("turn_detection", "auto"),
            )

            logger.info(f"Started session: {self.session_config.session_type}")

            # Reconfigure voice assistant based on session type
            if self.voice_assistant and self.session_config.session_type in [
                SessionType.VOICE_PTT, SessionType.VOICE_VAD,
            ]:
                await self._reconfigure_voice_assistant()

            # Send confirmation
            await self._send_message(
                content="Session started! I'm ready to help.",
                message_type="control",
                payload={"status": "session_started"},
            )

        elif payload.get("action") == "end_session":
            logger.info("Session ended")
            self.session_config = None

            # Stop any ongoing speech
            if self.voice_assistant:
                # Cancel any ongoing TTS
                try:
                    await self.voice_assistant.cancel()
                except:
                    pass  # Ignore errors during cleanup

            # Send confirmation
            await self._send_message(
                content="Session ended. Feel free to start a new one anytime!",
                message_type="control",
                payload={"status": "session_ended"},
            )

        elif payload.get("action") == "interrupt":
            """Handle user interruption (barge-in)."""
            if self.voice_assistant:
                try:
                    # Cancel current speech immediately
                    await self.voice_assistant.cancel()
                    logger.info("User interruption handled - speech cancelled")
                except Exception as e:
                    logger.error(f"Error handling interruption: {e}")

    async def _reconfigure_voice_assistant(self):
        """Reconfigure voice assistant based on session type."""
        if not self.voice_assistant:
            return

        try:
            if self.session_config.session_type == SessionType.VOICE_VAD:
                # Voice Activity Detection mode - optimized for low latency
                logger.info("Configuring VAD for automatic turn detection with low latency")
                # Current VAD settings are already optimized for this

            elif self.session_config.session_type == SessionType.VOICE_PTT:
                # Push-to-Talk mode - manual turn detection
                logger.info("Configuring for push-to-talk mode")
                # VAD settings would be adjusted for PTT in a full reconfiguration

            logger.info(f"Voice assistant reconfigured for {self.session_config.session_type}")

        except Exception as e:
            logger.error(f"Error reconfiguring voice assistant: {e}")

    def get_performance_stats(self) -> Dict[str, float]:
        """Get current performance statistics."""
        stats = {}

        for metric_name, values in self._performance_metrics.items():
            if values:
                stats[f"{metric_name}_avg"] = sum(values) / len(values)
                stats[f"{metric_name}_min"] = min(values)
                stats[f"{metric_name}_max"] = max(values)
                stats[f"{metric_name}_count"] = len(values)
            else:
                stats[f"{metric_name}_avg"] = 0.0
                stats[f"{metric_name}_min"] = 0.0
                stats[f"{metric_name}_max"] = 0.0
                stats[f"{metric_name}_count"] = 0

        return stats

    async def _send_message(self, content: str, message_type: str, payload: Dict[str, Any] = None):
        """Send a message via data channel."""
        if not self.participant:
            return

        message = DataChannelMessage(
            type=MessageType(message_type),
            payload=payload or {"content": content},
            timestamp=datetime.now().timestamp(),
            message_id=str(uuid.uuid4()),
        )

        # Send via data channel
        data = json.dumps(message.dict()).encode("utf-8")
        await self.room.local_participant.publish_data(data, kind=rtc.DataPacketKind.RELIABLE)

        logger.info(f"Sent {message_type} message")

    def _create_chat_context(self) -> ChatContext:
        """Create initial chat context."""
        ctx = ChatContext()
        ctx.append_message(
            role="system",
            content="You are BakeBot, a friendly and knowledgeable virtual sous chef.",
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
                            "content": msg.content,
                        })
                    elif msg.role == "assistant":
                        conversation_history.append({
                            "sender": "agent",
                            "content": msg.content,
                        })

                # Get the last user message
                last_message = ""
                for msg in reversed(messages):
                    if msg.role == "user":
                        last_message = msg.content
                        break

                # Generate response
                return await self.ai_service.generate_voice_response(
                    last_message, conversation_history[:-1],
                )

        return BakeBotLLMAdapter(self.ai_service)
