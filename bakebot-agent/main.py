import asyncio
import logging
import os
from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import JobContext, JobProcess, WorkerOptions, cli
from livekit.agents.llm import ChatContext
from agent.bakebot_agent import BakeBotAgent

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def prewarm(proc: JobProcess):
    """Pre-warm the agent process."""
    logger.info("Prewarming BakeBot agent...")
    # Add any pre-warming logic here (e.g., loading models)

async def job_request_cb(job: JobContext):
    """Handle job requests from LiveKit."""
    logger.info(f"Received job request: {job.job.metadata}")

    # Create and start the BakeBot agent
    agent = BakeBotAgent()

    try:
        # Start the agent
        await agent.start(job)

        # Keep the agent running
        while True:
            await asyncio.sleep(1)

    except Exception as e:
        logger.error(f"Error in job {job.job.id}: {e}")
        raise
    finally:
        logger.info(f"Cleaning up job {job.job.id}")
        await agent.cleanup()

if __name__ == "__main__":
    # Validate required environment variables
    required_vars = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'GOOGLE_API_KEY']
    missing_vars = [var for var in required_vars if not os.getenv(var)]

    if missing_vars:
        logger.error(f"Missing required environment variables: {missing_vars}")
        exit(1)

    # Configure worker options
    worker_options = WorkerOptions(
        entrypoint_fnc=job_request_cb,
        prewarm_fnc=prewarm,
        agent_name=os.getenv('AGENT_NAME', 'BakeBot'),
    )

    # Start the worker
    cli.run_app(worker_options)