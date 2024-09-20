const corsAnywhere = require('cors-anywhere');

corsAnywhere.createServer({
    originWhitelist: [],
}).listen(3000, 'localhost');