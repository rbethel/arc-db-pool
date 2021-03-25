@app
arc-db-pool

@http
get /
get /prisma



@tables
dbpool
  pk *String
  sk **String
  ttl TTL

@aws
profile default
region us-east-1

  