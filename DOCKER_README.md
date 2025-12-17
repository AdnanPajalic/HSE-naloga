# Docker Setup

You need ENTSO-E API key!!

## Quick Start using DOcker compose

1. **Create a .env file** in the project root:
```
 ENTSOE_API_KEY=your_api_key_here
```

2. **Build and run**:
```
docker-compose up --build
```

3. **Access the application**:
Open your browser and go to `http://localhost:5000`

4. **Stop the application**:
```
docker-compose down
```