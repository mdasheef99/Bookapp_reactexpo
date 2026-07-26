# Phase 9 fixture vision-analysis worker

Dedicated Node-compatible service boundary for Unit 4. It accepts a worker-only
ingress secret, uses a service-role client for the four M12 RPCs, and analyzes
only recorded `p9-vision-v2` fixtures selected by opaque sanitized-media
references. It contains no real provider, metadata, inventory, publication, or
Storage-path integration.
