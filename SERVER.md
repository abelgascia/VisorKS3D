# Configuración del servidor

Pasos reproducibles para configurar el servidor en caso de que sea necesario.  
Hay que adaptarlo si se mueve el repositorio.

```
apt-get update -y
apt-get install -y mariadb-server nginx
```

Configurar el repo para que se pueda clonar con una key SSH. [How to](https://developer.github.com/v3/guides/managing-deploy-keys/#deploy-keys).

```
git clone git@github.com:mlomb/KS-Visor3D.git

mysql < scheme.sql
```

Agregar en `/etc/nginx/nginx.conf`:

```
http {
    client_max_body_size 50M;

    ...
}
```

Crear `/etc/nginx/sites-enabled/viewer3d.keepsmilinglog.com`:

```
server {
    server_name viewer3d.keepsmilinglog.com;
    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version    1.1;
        proxy_set_header      Upgrade $http_upgrade;
        proxy_set_header      Connection "upgrade";
        proxy_connect_timeout 1;
    }
}
```

```
nginx -t
service nginx reload

apt-get install -y python-certbot-nginx
certbot --register-unsafely-without-email --nginx -d viewer3d.keepsmilinglog.com
```

```
cd ~
curl -sL https://deb.nodesource.com/setup_10.x -o nodesource_setup.sh
bash nodesource_setup.sh
rm nodesource_setup.sh
apt-get install -y nodejs
```

```
npm i -g pm2

# Estos de abajo los debería hacer el CI
cd ~/KS-Visor3D
npm i
pm2 reload ecosystem.config.js --env production --update-env
pm2 save
pm2 startup
```

```
pm2 list
```

## Redirección

Crear `/etc/nginx/sites-enabled/3d.keepsmilinglog.com`:

```
server {
    server_name 3d.keepsmilinglog.com;

    rewrite ^/(.*)$ https://viewer3d.keepsmilinglog.com/view/$arg_uuid? permanent;
}
```

```
nginx -t
service nginx reload

certbot --nginx -d 3d.keepsmilinglog.com
```

## Notas

* Los archivos de configuración de nginx se pueden encontrar en `/nginx`.