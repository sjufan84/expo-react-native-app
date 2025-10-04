from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from enum import Enum

class MessageType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    CONTROL = "control"

class SessionType(str, Enum):
    TEXT = "text"
    VOICE_PTT = "voice-ptt"
    VOICE_VAD = "voice-vad"

class DataChannelMessage(BaseModel):
    type: MessageType
    payload: Dict[str, Any]
    timestamp: float
    message_id: str

class TextMessage(BaseModel):
    content: str
    sender: str
    timestamp: float

class ImageMessage(BaseModel):
    data: str  # base64 encoded image
    metadata: Dict[str, Any]
    caption: Optional[str] = None
    timestamp: float

class SessionConfig(BaseModel):
    session_type: SessionType
    voice_mode: Optional[str] = None  # "ptt" or "vad"
    user_id: str
    turn_detection: str = "auto"  # "client", "server", or "auto"

class AgentResponse(BaseModel):
    content: str
    response_type: str  # "text" or "voice"
    timestamp: float
    metadata: Optional[Dict[str, Any]] = None