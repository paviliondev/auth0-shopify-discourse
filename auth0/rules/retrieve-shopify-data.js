async function (user, context, callback) {
  const metadata = user.user_metadata || {};
    
  if (!metadata.shopify || !metadata.shopify.active || !metadata.shopify.id) {
  	return callback(null, user, context);
  }
  
  const customerId = metadata.shopify.id;
  const keyMap = {
    group: []
  };
  
  let orderCountResult = await countOrders(customerId);
  let orderCount = orderCountResult.customer.orders_count;
    
  if (orderCount > 0) {
    let orders = await collectOrders(customerId, orderCount);
          
    if (orders && orders.length) {
      auth0.users.updateUserMetadata(user.user_id, updateMetadataFromOrders(orders, metadata))
        .then(function(result) {
          callback(null, user, context);
        }).catch(function(err){
          callback(err);
        });
    } else {
      callback(null, user, context);
    }
  } else {
    callback(null, user, context);
  }
  
  function updateMetadataFromOrders(orders, metadata) {
    let metafields = mapProductMetafields(orders);
          
    if (metafields && metafields.length) {
      let discourse_metafields = metafields.filter(m => m.namespace === 'discourse');
                    
      if (discourse_metafields) {
        metadata.discourse = metadata.discourse || {};
                
        discourse_metafields.forEach(f => {
          if (saveKey(f.key)) {
            let value = f.value;
            let currentValue = metadata.discourse[f.key] || keyMap[f.key];
                        
            if (currentValue) {
              if (Array.isArray(currentValue)) {
                if (currentValue.indexOf(value) === -1) {
                  currentValue.push(value);
                }
                value = currentValue;
              } else {
                value = value;
              }
            }
                        
            metadata.discourse[f.key] = value;
          }
        });
      }
    }
    
    return metadata;
  }
  
  async function collectOrders(customerId, orderCount) {
    let orders = [];
    let spent = false;
    let pages = Math.ceil(orderCount / 10);
    let pageCount = 1;
        
    while(pageCount <= pages && !spent) {
      let result = await getOrders(customerId);
      let pageOrders = result.data.customer.orders.edges;
            
      if (pageOrders && pageOrders.length) {
        orders = orders.concat(pageOrders);
      }
      
      let cost = result.extensions.cost;
      let available = cost.throttleStatus.currentlyAvailable;
      let requested = cost.requestedQueryCost;
      spent = requested > available;
      
      pageCount++;
    }
    
    return orders;
  }
  
  async function countOrders(customerId) {
    const shopifyUrl = `${configuration.shopify_api_key}:${configuration.shopify_api_password}@${configuration.shopify_domain}`;
    const customerUrl = `https://${shopifyUrl}/admin/api/2020-01/customers/${customerId}.json?fields=orders_count`;
    return new Promise(function (resolve, reject) {
      request(customerUrl, function (error, res, body) {
        if (!error && res.statusCode === 200) {
          resolve(JSON.parse(body));
        } else {
          reject(error);
        }
      });
    });
  }
  
  function getOrders(customerId) {
    const fetch = require('node-fetch@2.6.0');
    const url = `https://${configuration.shopify_domain}/admin/api/2020-01/graphql.json`;
    const headers = {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': configuration.shopify_api_password
    };
    return new Promise(function (resolve, reject) {
      fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ query: graphqlQuery(customerId) })
      })
      .then(result => resolve(result.json()))
      .catch(json => reject(json));
    });
  }
  
  function graphqlQuery(customerId) {
    return `{
    	customer(id: "gid://shopify/Customer/${customerId}") {
    		orders(first: 10){
    	    edges {
    	    	node {
    	        lineItems(first: 10) {
    	        	edges {
    	        		node {
    	        			product {
    	        				metafields(first: 3) {
    	        					edges {
    	        						node {
    	        							namespace
    	        							key
    	        							value
    	        						}
    	        					}
    	        				}
    	        			}
    	        		}
    	        	}
    	        }
    	      }
    	    }
    	  }
      }
    }`;
  }
  
  function mapProductMetafields(orders) {
    let metafields = [];
    
    orders.forEach(function(order) {
      order.node.lineItems.edges.forEach(function(item) {
        if (item.node.product) {
          item.node.product.metafields.edges.forEach(function(field) {
            metafields.push(field.node);
          });
        }
      });
    });
    
    return metafields;
  }
  
  function saveKey(key) {
    return Object.keys(keyMap).indexOf(key) > -1;
  }
}
