
export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({
            ok: false,
            error: "method_not_allowed"
        });
    }

    const { token, server_id: serverId } = req.body || {};

    if (
        typeof token !== "string" ||
        !/^[a-f0-9]{64}$/i.test(token) ||
        typeof serverId !== "string" ||
        !/^[a-zA-Z0-9-]{1,64}$/.test(serverId)
    ) {
        return res.status(400).json({
            ok: false,
            error: "invalid_request"
        });
    }

    const callbackUrl = process.env.PANEL_ADS_COMPLETE_URL;
    const secret = process.env.VTH_ADS_SHARED_SECRET;

    if (!callbackUrl || !secret) {
        return res.status(500).json({
            ok: false,
            error: "server_configuration_error"
        });
    }

    let callback;

    try {
        callback = new URL(callbackUrl);

        if (callback.protocol !== "https:") {
            throw new Error("HTTPS required");
        }
    } catch {
        return res.status(500).json({
            ok: false,
            error: "invalid_callback_configuration"
        });
    }

    try {
        const response = await fetch(callback.href, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "X-VTH-Ads-Secret": secret
            },
            body: JSON.stringify({
                token,
                server_id: serverId
            }),
            signal: AbortSignal.timeout(10000)
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok || result.ok !== true) {
            return res.status(502).json({
                ok: false,
                error: "panel_validation_failed"
            });
        }

        return res.status(200).json({ ok: true });

    } catch (error) {
        console.error("Ads callback failed:", error.message);

        return res.status(502).json({
            ok: false,
            error: "panel_unavailable"
        });
    }
}
