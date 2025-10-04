import os
import logging
import asyncio
from typing import Optional, AsyncGenerator
from google.cloud import speech
from google.cloud import texttospeech
import tempfile
import io
from livekit import rtc
from livekit.agents import stt, tts

logger = logging.getLogger(__name__)

class SpeechService:
    """Service for speech-to-text and text-to-speech using Google Cloud."""

    def __init__(self):
        # Initialize Google Cloud Speech client
        self.speech_client = speech.SpeechClient()
        self.tts_client = texttospeech.TextToSpeechClient()

        # STT configuration
        self.stt_config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=16000,
            language_code="en-US",
            enable_automatic_punctuation=True,
            enable_word_confidence=True,
            model="latest_short",
        )

        # Streaming configuration
        self.streaming_config = speech.StreamingRecognitionConfig(
            config=self.stt_config,
            interim_results=True,
            single_utterance=False,
        )

    async def transcribe_audio_stream(self, audio_stream) -> str:
        """Transcribe audio stream to text using Google Speech-to-Text."""
        try:
            # Configure streaming
            requests = [
                speech.StreamingRecognizeRequest(audio_content=chunk)
                for chunk in audio_stream
            ]

            # Perform streaming transcription
            responses = self.speech_client.streaming_recognize(
                config=self.streaming_config,
                requests=iter(requests)
            )

            # Collect results
            transcript = ""
            for response in responses:
                if response.results:
                    result = response.results[0]
                    if result.is_final:
                        transcript = result.alternatives[0].transcript

            return transcript

        except Exception as e:
            logger.error(f"Error transcribing audio: {e}")
            return ""

class GoogleStreamSTT(stt.STT):
    """Google Cloud Streaming Speech-to-Text adapter for LiveKit."""

    def __init__(self):
        super().__init__()
        self._speech_client = speech.SpeechClient()
        self._config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=16000,
            language_code="en-US",
            enable_automatic_punctuation=True,
            enable_word_confidence=True,
            model="latest_short",
            max_alternatives=1,
            # Enable enhanced models for better accuracy
            use_enhanced=True,
            # Optimize for low latency
            adaptation_config=speech.SpeechAdaptation(
                phrase_sets=[speech.SpeechContext(phrases=["BakeBot", "recipe", "ingredient", "temperature", "oven", "stove"])]
            )
        )
        self._streaming_config = speech.StreamingRecognitionConfig(
            config=self._config,
            interim_results=True,
            single_utterance=False,
            # Optimize for low latency
            enable_voice_activity_events=True,
        )

    async def recognize(self, buffer: rtc.AudioFrame, *, language: str = None) -> stt.SpeechEvent:
        """Not used in streaming mode."""
        return stt.SpeechEvent(
            type=stt.SpeechEventType.END_OF_SPEECH,
            alternatives=[stt.SpeechData(text="")]
        )

    async def stream(self) -> stt.SpeechStream:
        """Create a streaming STT session."""
        return GoogleSTTStream(self._speech_client, self._config, self._streaming_config)

class GoogleSTTStream(stt.SpeechStream):
    """Google Cloud STT stream implementation."""

    def __init__(self, client: speech.SpeechClient, config: speech.RecognitionConfig,
                 streaming_config: speech.StreamingRecognitionConfig):
        super().__init__()
        self._client = client
        self._config = config
        self._streaming_config = streaming_config
        self._stream = None
        self._requests_queue = asyncio.Queue()
        self._task = None

    async def __aenter__(self):
        # Start the streaming session
        self._stream = self._client.streaming_recognize(
            config=self._streaming_config,
            requests=self._generate_requests()
        )
        self._task = asyncio.create_task(self._process_responses())
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        # End the stream
        await self._requests_queue.put(None)  # Sentinel value
        if self._task:
            await self._task
        if self._stream:
            self._stream._end_stream()

    async def _generate_requests(self):
        """Generate requests for the streaming API."""
        while True:
            request = await self._requests_queue.get()
            if request is None:  # Sentinel value
                break
            yield request

    async def _process_responses(self):
        """Process responses from Google Speech API."""
        try:
            for response in self._stream:
                if not response.results:
                    continue

                result = response.results[0]
                if result.is_final and result.alternatives:
                    alternative = result.alternatives[0]
                    speech_event = stt.SpeechEvent(
                        type=stt.SpeechEventType.FINAL_TRANSCRIPT,
                        alternatives=[stt.SpeechData(
                            text=alternative.transcript,
                            confidence=alternative.confidence or 0.0
                        )]
                    )
                    await self._queue.put(speech_event)
        except Exception as e:
            logger.error(f"Error processing STT responses: {e}")

    async def push_frame(self, frame: rtc.AudioFrame):
        """Push audio frame to the stream."""
        if frame.data:
            request = speech.StreamingRecognizeRequest(audio_content=frame.data.tobytes())
            await self._requests_queue.put(request)

    async def flush(self):
        """Flush pending audio."""
        pass

class GoogleStreamTTS(tts.TTS):
    """Google Cloud Streaming Text-to-Speech adapter for LiveKit."""

    def __init__(self):
        super().__init__()
        self._client = texttospeech.TextToSpeechClient()
        self._voice_params = texttospeech.VoiceSelectionParams(
            language_code="en-US",
            ssml_gender=texttospeech.SsmlVoiceGender.FEMALE,
            # Use WaveNet for higher quality and lower latency
            name="en-US-Wavenet-F"
        )
        self._audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.LINEAR16,
            speaking_rate=0.95,  # Slightly slower for clarity
            pitch=0.0,
            # Optimize for low latency
            sample_rate_hertz=16000,
        )

    async def synthesize(self, text: str, *, language: str = None) -> rtc.AudioFrame:
        """Synthesize text to speech (non-streaming)."""
        try:
            synthesis_input = texttospeech.SynthesisInput(text=text)
            response = self._client.synthesize_speech(
                input=synthesis_input,
                voice=self._voice_params,
                audio_config=self._audio_config
            )

            return rtc.AudioFrame(
                data=response.audio_content,
                sample_rate=16000,
                num_channels=1,
                samples_per_channel=len(response.audio_content) // 2
            )
        except Exception as e:
            logger.error(f"Error synthesizing speech: {e}")
            # Return empty frame
            return rtc.AudioFrame(
                data=b'',
                sample_rate=16000,
                num_channels=1,
                samples_per_channel=0
            )

    async def stream(self) -> tts.SynthesizeStream:
        """Create a streaming TTS session."""
        return GoogleTTSStream(self._client, self._voice_params, self._audio_config)

class GoogleTTSStream(tts.SynthesizeStream):
    """Google Cloud TTS stream implementation."""

    def __init__(self, client: texttospeech.TextToSpeechClient,
                 voice_params: texttospeech.VoiceSelectionParams,
                 audio_config: texttospeech.AudioConfig):
        super().__init__()
        self._client = client
        self._voice_params = voice_params
        self._audio_config = audio_config

    async def push_text(self, text: str):
        """Push text to be synthesized."""
        if not text.strip():
            return

        try:
            synthesis_input = texttospeech.SynthesisInput(text=text)
            response = self._client.synthesize_speech(
                input=synthesis_input,
                voice=self._voice_params,
                audio_config=self._audio_config
            )

            # Create audio frame and push to queue
            frame = rtc.AudioFrame(
                data=response.audio_content,
                sample_rate=16000,
                num_channels=1,
                samples_per_channel=len(response.audio_content) // 2
            )
            await self._queue.put(frame)

        except Exception as e:
            logger.error(f"Error in TTS stream: {e}")

    async def flush(self):
        """Flush pending text."""
        pass

    async def mark_segment_end(self):
        """Mark the end of a segment."""
        pass

    async def synthesize_speech(self, text: str, voice_gender: str = "FEMALE") -> bytes:
        """Convert text to speech using Google Text-to-Speech."""
        try:
            # Configure voice
            voice_selection_params = texttospeech.VoiceSelectionParams(
                language_code="en-US",
                ssml_gender=texttospeech.SsmlVoiceGender[voice_gender]
            )

            # Configure audio output
            audio_config = texttospeech.AudioConfig(
                audio_encoding=texttospeech.AudioEncoding.LINEAR16,
                speaking_rate=0.95,  # Slightly slower for cooking instructions
                pitch=0.0,  # Neutral pitch
            )

            # Create synthesis request
            synthesis_input = texttospeech.SynthesisInput(text=text)

            # Perform synthesis
            response = self.tts_client.synthesize_speech(
                input=synthesis_input,
                voice=voice_selection_params,
                audio_config=audio_config
            )

            return response.audio_content

        except Exception as e:
            logger.error(f"Error synthesizing speech: {e}")
            # Return empty bytes on error
            return b""

    def get_voice_settings(self) -> dict:
        """Get voice settings for TTS."""
        return {
            "gender": "FEMALE",  # Friendly female voice for BakeBot
            "language_code": "en-US",
            "speaking_rate": 0.95,  # Clear and slightly slower for instructions
            "pitch": 0.0,  # Natural pitch
        }