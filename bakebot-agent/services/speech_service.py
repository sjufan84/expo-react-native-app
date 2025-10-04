import os
import logging
import asyncio
from typing import Optional
from google.cloud import speech
from google.cloud import texttospeech
import tempfile
import io

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