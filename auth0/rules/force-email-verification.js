function (user, context, callback) {
  if (!user.email_verified && context.request.query.resend_verification_email) {
    var ManagementClient = require('auth0@2.9.1').ManagementClient;
    var management = new ManagementClient({
      token: auth0.accessToken,
      domain: auth0.domain
    });
    
    const userId = user.identities.find(i => i.connection === 'Username-Password-Authentication').user_id;
    
    management.sendEmailVerification({
      client_id: <auth0_shopify_client_id>,
      user_id: 'auth0|' + userId
    });
    return callback(null, user, context);
  } else {
    return callback(null, user, context);
  }
}
