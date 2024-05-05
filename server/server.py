from aiohttp import web
from websockets.exceptions import ConnectionClosedOK
import aioredis
import asyncio
import json
import logging
import os
import websockets

countdown_secs = 300  # Reset every 5 minutes
time_remaining = countdown_secs
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost")

logging.basicConfig(level=logging.INFO)


async def handler(websocket, path):
    try:
        redis = await aioredis.from_url(REDIS_URL)
        pubsub = redis.pubsub()
        await pubsub.subscribe('drawing_updates')

        async def reader():
            async for message in pubsub.listen():
                if message['type'] == 'message':
                    await websocket.send(message['data'].decode('utf-8'))

        asyncio.create_task(reader())

        while True:
            new_data = await websocket.recv()
            update = {
                'data': new_data,
                'time_remaining': time_remaining
            }
            await redis.rpush("drawing_data", json.dumps(update))
            await redis.publish("drawing_updates", json.dumps(update))

    except ConnectionClosedOK:
        logging.info("Connection closed properly")
    except Exception as e:
        logging.error(f"Error in handler: {e}")
    finally:
        await pubsub.unsubscribe('drawing_updates')
        if 'redis' in locals():
            await redis.close()


async def get_drawing_data(request):
    try:
        redis = await aioredis.from_url(REDIS_URL)
        existing_data = await redis.lrange("drawing_data", 0, -1)
        return web.json_response([data.decode('utf-8') for data in existing_data])
    except Exception as e:
        logging.error(f"Error in get_drawing_data: {e}")
        return web.Response(status=500)


async def send_time_updates(redis):
    try:
        while True:
            await asyncio.sleep(1)
            update = {'time_remaining': time_remaining}
            await redis.publish("drawing_updates", json.dumps(update))
    except Exception as e:
        logging.error(f"Error in send_time_updates: {e}")


async def countdown(redis):
    global time_remaining
    while True:
        time_sec = countdown_secs
        try:
            while time_sec > 0:
                await asyncio.sleep(1)
                time_sec -= 1
                time_remaining = time_sec
            await redis.delete("drawing_data")
            clear_update = {'clear_canvas': True, 'time_remaining': 0}
            await redis.publish("drawing_updates", json.dumps(clear_update))
        except Exception as e:
            logging.error(f"Error in countdown: {e}")


async def main():
    try:
        app = web.Application()
        app.add_routes([web.get('/api/getdrawingdata', get_drawing_data)])

        redis = await aioredis.from_url(REDIS_URL)
        server = await websockets.serve(handler, '0.0.0.0', 37043)
        asyncio.create_task(send_time_updates(redis))
        asyncio.create_task(countdown(redis))

        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, '0.0.0.0', 37044)
        await site.start()

        await server.wait_closed()
    except Exception as e:
        logging.error(f"Error in main: {e}")


if __name__ == "__main__":
    asyncio.run(main())
