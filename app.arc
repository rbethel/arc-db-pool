@app
arc-db-pool

@http
get /
get /timetest
get /hkdb



@tables
dbpool
  pk *String
  sk **String
  ttl TTL

@aws
profile default
region us-east-1

  