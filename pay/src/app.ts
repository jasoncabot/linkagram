import express, { Request } from 'express';
import fs from "fs";
import https from "https";

const app = express();
app.disable("x-powered-by");
const port = 3443;

const httpsAgent = new https.Agent({
    key: fs.readFileSync('./merchant_id.key.pem'),
    cert: fs.readFileSync('./merchant_id.crt.pem')
});

app.get("/", (_req, res) => {
    console.log("GET /");
    res.send("ok");
    res.end();
});

app.post("/session", async (request: Request, resp) => {
    console.log("POST /session");

    const validAppleVerificationDomains = new Set<string>([
        "apple-pay-gateway.apple.com",
        "cn-apple-pay-gateway.apple.com",
        "apple-pay-gateway-nc-pod1.apple.com",
        "apple-pay-gateway-nc-pod2.apple.com",
        "apple-pay-gateway-nc-pod3.apple.com",
        "apple-pay-gateway-nc-pod4.apple.com",
        "apple-pay-gateway-nc-pod5.apple.com",
        "apple-pay-gateway-pr-pod1.apple.com",
        "apple-pay-gateway-pr-pod2.apple.com",
        "apple-pay-gateway-pr-pod3.apple.com",
        "apple-pay-gateway-pr-pod4.apple.com",
        "apple-pay-gateway-pr-pod5.apple.com",
        "cn-apple-pay-gateway-sh-pod1.apple.com",
        "cn-apple-pay-gateway-sh-pod2.apple.com",
        "cn-apple-pay-gateway-sh-pod3.apple.com",
        "cn-apple-pay-gateway-tj-pod1.apple.com",
        "cn-apple-pay-gateway-tj-pod2.apple.com",
        "cn-apple-pay-gateway-tj-pod3.apple.com",
        "apple-pay-gateway-cert.apple.com",
        "cn-apple-pay-gateway-cert.apple.com"
    ]);

    const validationURL = request.query['validationURL']?.toString() || "";
    console.log('validationURL = ' + validationURL);

    const { host, hostname, pathname } = new URL(validationURL);
    console.log('host = ' + host);
    console.log('hostname = ' + hostname);
    console.log('pathname = ' + pathname);

    if (!validationURL || !validAppleVerificationDomains.has(host)) {
        resp.write("invalid validationURL");
        resp.end();
        return;
    }

    const requestData = JSON.stringify(
        {
            "merchantIdentifier": "merchant.com.jasoncabot.linkagram",
            "displayName": "Linkagram",
            "initiative": "web",
            "initiativeContext": "linkagram.jasoncabot.me"
        }
    );

    const options = {
        hostname: hostname,
        path: pathname,
        port: 443,
        method: 'POST',
        agent: httpsAgent,
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': requestData.length
        }
    } as https.RequestOptions;

    const req = https.request(options, res => {
        res.on('data', d => {
            resp.write(d);
        });
        res.on('end', () => {
            resp.end()
        });
    });
    req.on('error', e => {
        resp.write("unable to make apple pay request");
        resp.end();
    });
    req.write(requestData);
    req.end();
})

// start the Express server
app.listen(port, () => {
    console.log(`apple-pay-proxy started at http://localhost:${port}`);
});
