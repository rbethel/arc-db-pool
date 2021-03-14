@app
arc-db-pool

@http
get /

@tables
dbpool
  pk *String
  sk **String
  ttl TTL

@aws
profile default
region us-east-1

  