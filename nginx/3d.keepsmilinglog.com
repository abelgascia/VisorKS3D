server {
    server_name 3d.keepsmilinglog.com;
	
    rewrite ^/(.*)$ https://viewer3d.keepsmilinglog.com/view/$arg_uuid? permanent;
}
