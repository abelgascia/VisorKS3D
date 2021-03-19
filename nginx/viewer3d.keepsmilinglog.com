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
