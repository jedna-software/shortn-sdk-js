# Security

## Supported Versions

Security fixes are published for the latest minor release.

## Reporting a Vulnerability

Email security reports to support@shortn.link with "Security" in the subject. Do not open a public issue with exploit details, API keys, tokens, customer data, or logs containing secrets.

Include:

- A clear description of the issue.
- A minimal reproduction, if safe to share.
- The SDK version and runtime version.
- Whether any credentials or customer data may have been exposed.

## API Key Safety

This package is a server-side SDK. Do not bundle it with a secret API key into browser code, mobile apps, public static sites, or any client-controlled runtime.

For browser attribution capture, use the Shortn Link capture script. Browser helpers must never require a secret API key.
