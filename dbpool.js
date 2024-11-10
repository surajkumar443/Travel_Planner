const mysql = require('mysql');

const pool=mysql.createPool({
    connectionLimit: 30,
    host:'zy4wtsaw3sjejnud.cbetxkdyhwsb.us-east-1.rds.amazonaws.com',
    user:'byiu479xw24g0zf2',
    password:'trgjxbuxzbgrdzwj',
    database:'fbaylj4d0i9re30g'
});

module.exports=pool;