import sys
import asyncio
import edge_tts

async def synthesize():
    # Set stdin encoding to utf-8
    if hasattr(sys.stdin, 'reconfigure'):
        sys.stdin.reconfigure(encoding='utf-8')
    
    text = sys.stdin.read().strip()
    if not text:
        sys.exit(0)
    
    voice = sys.argv[1] if len(sys.argv) > 1 else 'fa-IR-DilaraNeural'
    rate = sys.argv[2] if len(sys.argv) > 2 else '+0%'
    pitch = sys.argv[3] if len(sys.argv) > 3 else '+0Hz'

    communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            sys.stdout.buffer.write(chunk["data"])
    sys.stdout.buffer.flush()

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(synthesize())
