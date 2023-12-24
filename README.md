# Scribble Fusion

Scribble Fusion is a collaborative drawing platform.

To see it in action, visit [scribblefusion.com](https://scribblefusion.com).

## Setup

1. Modify `client/Caddyfile`.
Replace `scribblefusion.com` with your domain.  
2. `docker network create sf_network`
3. Run `docker-compose up -d` in both the `client`
and `server` directories.

## Contributing

Contributions of any kind are always welcome.

### High priority needs

- Better server scaling.