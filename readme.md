## Asterisk AMI High-Load Parser and Connector

The application is a template for a high-load parser of AMI data from Asterisk instance. The parsed AMI data 
are put into Redis storage incrementally. Each Asterisk channel is represented as hash table 
which is updated with every AMI message received. Time-sensitive volatile data like channel's context 
are stored into ordered set under channel's namespace. 
Every change in channel updates the list of changed "dirty" channels, which can be retrieved regularly (e.g. by timer).
This application puts Redis storage as a middleware between high-load intensive data stream (up to 10 MB\sec) 
for analytical or management purposes.
You can connect multiple Asterisk instance to same Redis instance. 
Their data are isolated by Redis database switching (refer SELECT command in Redis documentation).

### Deployment

The app is dockerized. It starts two containers: one for AmiClient and redis instance. Redis is configured to turn off
data persistence, so it is a pure in-memory storage. That provides a stunning Redis performance for storing or 
retrieving Asterisk channel data.

### Prometheus monitoring

AmiClient implements its own statistics for read/sent bytes and AMI message counter. The data are collected by 
Prometheus metrics endpoint and published upon request.
