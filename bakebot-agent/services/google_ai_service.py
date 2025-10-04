"""Service for interacting with Google AI models (LLM and Vision)."""
import os
import logging
import base64
from typing import Optional, List, Dict
import google.generativeai as genai
from PIL import Image
import io

logger = logging.getLogger(__name__)

class GoogleAIService:
    """Service for interacting with Google AI models (LLM and Vision)."""

    def __init__(self):
        self.api_key = os.getenv("GOOGLE_API_KEY")
        if not self.api_key:
            raise ValueError("GOOGLE_API_KEY environment variable is required")

        genai.configure(api_key=self.api_key)

        # Initialize models
        self.text_model = genai.GenerativeModel("gemini-1.5-flash")
        self.vision_model = genai.GenerativeModel("gemini-1.5-pro-vision-latest")

        # System prompt for BakeBot
        self.system_prompt = """You are BakeBot, a friendly and knowledgeable virtual sous chef.
        You help users with cooking questions, recipes, techniques, and food advice.

        Guidelines:
        - Be encouraging and supportive, especially for beginners
        - Provide clear, step-by-step instructions
        - Offer substitutions for dietary restrictions when possible
        - Explain cooking techniques in simple terms
        - Ask clarifying questions when needed
        - Keep responses conversational and engaging
        - If you see an image of food or cooking, provide specific advice based on what you observe

        Always be helpful, accurate, and maintain a positive, enthusiastic tone about cooking!"""

    async def generate_text_response(self, message: str, conversation_history: List[Dict[str, str]] = None) -> str:
        """Generate a text response from the AI model."""
        try:
            # Prepare conversation history
            chat_history = []
            if conversation_history:
                for msg in conversation_history:
                    chat_history.append({
                        "role": "user" if msg.get("sender") == "user" else "model",
                        "parts": [msg.get("content", "")],
                    })

            # Start chat with system prompt
            chat = self.text_model.start_chat(history=chat_history)

            # Send the system prompt first
            await chat.send_message_async(self.system_prompt)

            # Generate response
            response = await chat.send_message_async(message)
            return response.text

        except Exception as e:
            logger.error(f"Error generating text response: {e}")
            return "I'm having trouble thinking right now. Could you try asking me again?"

    async def analyze_image(self, image_data: str, caption: Optional[str] = None, question: Optional[str] = None) -> str:
        """Analyze an image and provide cooking-related advice."""
        try:
            # Decode base64 image
            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes))

            # Prepare the prompt
            if question:
                prompt = f"{self.system_prompt}\n\nUser question: {question}"
            elif caption:
                prompt = f"{self.system_prompt}\n\nUser says: {caption}\n\nWhat can you tell me about this image?"
            else:
                prompt = f"{self.system_prompt}\n\nWhat can you tell me about this cooking-related image?"

            # Generate response with vision model
            response = await self.vision_model.generate_content_async([prompt, image])
            return response.text

        except Exception as e:
            logger.error(f"Error analyzing image: {e}")
            return "I can see an image, but I'm having trouble analyzing it right now. Can you describe what you'd like to know about it?"

    async def generate_voice_response(self, transcript: str, conversation_history: List[Dict[str, str]] = None) -> str:
        """Generate a response optimized for voice output."""
        try:
            # Generate the response using text model
            text_response = await self.generate_text_response(transcript, conversation_history)

            # Make it more conversational for voice
            # Add natural pauses and conversational elements
            voice_response = text_response

            # Ensure response isn't too long for voice
            if len(voice_response) > 500:
                # Break into shorter, more digestible chunks
                sentences = voice_response.split(". ")
                if len(sentences) > 3:
                    voice_response = ". ".join(sentences[:3]) + ". Would you like me to continue with more details?"

            return voice_response

        except Exception as e:
            logger.error(f"Error generating voice response: {e}")
            return "I'm having trouble responding right now. Could you try that again?"
