async function (user, context, callback) {
  user.user_metadata = user.user_metadata || {};
  
  if ((context.clientName !== 'shopify') ||
      (user.user_metadata.shopify &&
       user.user_metadata.shopify.url === configuration.shopify_domain &&
       user.user_metadata.shopify.active)) {
  	return callback(null, user, context);
  }
  
  const request = require('request');
  const crypto = require("crypto");
  
  // Generated password used to login shopify user on successfully auth0 login
  // Note that this is encrypted and stored in the user's auth0 metadata.
  let password = crypto.randomBytes(20).toString('hex');

  const shopify_user = {
    "customer": {
      "email": user.email,
      "first_name": user.given_name,
      "last_name": user.family_name,
      "password": password,
      "password_confirmation": password,
      "send_email_welcome": false
    }
  };
      
  const c = configuration;
  const shopifyUrl = `${c.shopify_api_key}:${c.shopify_api_password}@${c.shopify_domain}`;
  const shopifyCustomersUrl = `https://${shopifyUrl}/admin/api/2019-10/customers`;
  let method = 'POST';
  let url = shopifyCustomersUrl + '.json';
  
  function asyncRequest(url) {
    return new Promise(function (resolve, reject) {
      request(url, function (error, res, body) {
        if (!error && res.statusCode === 200) {
          resolve(JSON.parse(body));
        } else {
          reject(error);
        }
      });
    });
  }
	
  let existingCustomer = null;
  let searchResult = await asyncRequest(
    shopifyCustomersUrl + `/search.json?query=email:${encodeURIComponent(user.email)}`
  );
    
  if (searchResult.customers && searchResult.customers.length) {
    existingCustomer = searchResult.customers.find(c => c.email === user.email);
  }
      
  if (existingCustomer) {
  	method = 'PUT';
    url = shopifyCustomersUrl + '/' + existingCustomer.id + '.json';
  } else {
  	shopify_user.customer.metafields = [
      {
        "key": "email_verified",
        "value": "false",
        "value_type": "string",
        "namespace": "auth0"
      }
    ];
  }
  
  request({
    method,
    url,
    json: shopify_user
  }, function(error, response, body) {
    if (error) {
    	callback(error);
    } else {
            
      if (body.customer) {
        user.user_metadata.shopify = {
          id: body.customer.id,
          active: true,
          password: encrypt(password),
          url: configuration.shopify_domain
        };

        auth0.users.updateUserMetadata(user.user_id, user.user_metadata)
          .then(function(result) {
            callback(null, user, context);
          }).catch(function(err){
            callback(err);
          }); 
      }
    }   
  });
  
  function encrypt(text) {
    const IV_LENGTH = 16;
    const NONCE_LENGTH = 5;
    const key = crypto.pbkdf2Sync(configuration.encryption_key, user.user_id, 10000, 32, 'sha512');
    
    let nonce = crypto.randomBytes(NONCE_LENGTH);
    let iv = Buffer.alloc(IV_LENGTH);
    nonce.copy(iv);

    let cipher = crypto.createCipheriv('aes-256-ctr', key, iv);
    let encrypted = cipher.update(text.toString());
    let message = Buffer.concat([nonce, encrypted, cipher.final()]);
    
    return message.toString('base64');
  }
  
  // See further https://stackoverflow.com/questions/50307269/nodejs-crypto-is-there-any-encrypt-and-decrypt-text-should-give-different-encry
}