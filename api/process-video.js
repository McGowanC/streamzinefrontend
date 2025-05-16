// frontend/api/process-video.js

export default async function handler(req, res) {
    // 1. Only allow POST requests
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // 2. Get Cloudflare Access credentials from Vercel environment variables
    const cfAccessClientId = process.env.CF_ACCESS_CLIENT_ID;
    const cfAccessClientSecret = process.env.CF_ACCESS_CLIENT_SECRET;

    if (!cfAccessClientId || !cfAccessClientSecret) {
        console.error("Cloudflare Access credentials not configured in Vercel environment variables.");
        return res.status(500).json({
            message: "Server configuration error.",
            error_detail: "Cloudflare Access credentials missing."
        });
    }

    // 3. Get the target tunnel URL (your self-hosted backend)
    // You should store this in an environment variable too for flexibility
    const targetBaseUrl = process.env.CLOUDFLARE_TUNNEL_URL; // e.g., https://your-tunnel-hostname.com
    if (!targetBaseUrl) {
        console.error("Cloudflare Tunnel URL not configured in Vercel environment variables.");
        return res.status(500).json({
            message: "Server configuration error.",
            error_detail: "Target tunnel URL missing."
        });
    }

    const targetUrl = `${targetBaseUrl}/process-video`; // Assuming the endpoint on your backend is /process-video

    try {
        // 4. Forward the request to your self-hosted backend
        const backendResponse = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'CF-Access-Client-Id': cfAccessClientId,
                'CF-Access-Client-Secret': cfAccessClientSecret,
            },
            body: JSON.stringify(req.body), // Forward the body from the frontend
        });

        // 5. Get the response from the backend
        const responseData = await backendResponse.json(); // Assuming backend always sends JSON

        // 6. Send the backend's response (status and data) back to the client
        // It's good practice to forward the status code from the backend
        res.status(backendResponse.status).json(responseData);

    } catch (error) {
        console.error('Error forwarding request to backend:', error);
        res.status(502).json({ // 502 Bad Gateway is appropriate if the BFF can't reach the origin
            message: 'Failed to process video.',
            error_detail: error.message
        });
    }
}