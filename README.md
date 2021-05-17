# Integrate Auth0, Shopify and Discourse (without Multipass)

This repository contains the modifications necessary for a Shopify, Auth0 and Discourse customer integration, without Shopify Multipass. The Discourse piece of this is optional; you could implement just the Shopify and Auth0 parts and they will work by themselves.

The original use of this code was for a community that used Shopify to sell premium content that could be accessed in private Discourse categories. You may need to tweak some of this implementation to support different use cases.

Please note that Shopify does have an in-built SSO mechanism for customers called "Multipass", available to Shopify Plus customers. If you can afford Shopify Plus, you should use Multipass instead of this.

> :warning: You should conduct your own security review before implementing this approach.

## Shopify Setup

All references to files in this section are to files in the ``shopify`` folder.

### 1. Add the code

The first step is to add the auth0 Javascript, CSS and settings to your Shopify theme. Ideally these should be added to your Shopify theme git repository and deployed along with the rest of the theme whenever it's used.

If it is not possible to add these files to the Shopify theme git, you need to ensure they remain present in the theme whenever it's deployed or updated. You can add or edit files in a theme via the code editor in the theme "Actions" menu.

#### auth0.js.liquid

This contains the auth0 login, signup and email verification logic. It should be added as an "Asset".

#### auth0.css.liquid

This contains the auth0 login, signup and email verification styles. It should be added as an "Asset".

#### theme.liquid

This contains code snippets that need to be added to the theme's main theme.liquid layout file (in "Layouts") according to the comments in that file.

#### settings_schema.json

This contains a schema for a Auth0 settings group. This schema needs to be added as a top level object in the theme's ``settings_schema.json`` file (in "Config").

#### checkout_scripts

This contains a snippet of code that needs to be added to the "Additional scripts" input of the "Order processing" section of the "Checking" settings.

> :warning: Make sure you follow the "Notes" at the bottom of the file.

This script inserts a button that links the customer directly to their content on Discourse.

### 2. Configure the settings

#### Auth0

These settings need filling out to connect the Auth0 code added to the theme to a particular Auth0 tenant.

- ``auth0_domain``: the domain of the Auth0 tenant this Shopify is being associated with.
- ``auth0_client_id``: the client id of the Auth0 application for this Shopify instance.

#### Webhook

Part of the connection between Shopify and Discourse is handled via Webhook. This requires some administration in Shopify, and some in Discourse.

To add a webhook to Shopify, navigate to the bottom of the Shopify "Notifications" settings panel and add a webhook with a callback url following this format:

- ``event``: "Order payment"
- ``Callback URL``: "https://{{discourse_url}}/webhook-receiver/receive"

This will send a payload to Discourse whenever payment for a product is completed on Shopify. 

The payload is handled on the Discourse end by the [Discourse Webhook Receiver Plugin](https://thepavilion.io/c/knowledge/discourse/webhook-receiver/200). Follow the steps in that plugin's documentation to set it up on your Discourse instance.

#### Checkout

In addition to the scripts in "Additional scripts" (see above) the follow Checkout settings need to be set:

- Customer Accounts: ``Accounts are required``
- Customer Contact: ``Customers can only check out using email``

### 3. Setup the API

Create a private app to allow Auth0 to interact with the store via the Shopify API. The API Key and Password are required for the Auth0 rules. 

The app requires the following permissions:
- Customers: Read and Write
- Orders: Read
- Products: Read

## Auth0 Setup

### 1. Setup the tenant, applications and APIs

This implementation assumes certain tenant, application and api settings.

#### Tenant

``Allowed logout urls``. This must contain the url of each service being used, i.e. both the Shopify and Discourse urls.

#### Applications

Each service connected to the system needs an application. The ClientID and Secret for each application are used at various places in the code and settings of the services, so if the applications are changed or you're working with a different environment, make sure the ClientID and Secret for each application is updated throughout the system.

- Discourse. Relevant settings:
   - Application Type: Regular Web Application
   - Token Endpoint Auth Method: Post
   - Allowed callback URLs: <discourse_url>/auth/oauth2_basic/callback
   - Allowed logout URLs: <discourse_url>
   - Advanced:
      - Grant Types: must include ``Client Credentials``.
  
- Shopify. Relevant Settings:
   - Application Type: Single Page Application
   - Allowed callback URLs: <shopify_url>
   - Allowed logout URLs: <shopify_url>
   - Allowed Web Origins: <shopify_url>

#### APIs

Two APIs are necessary:

- Authentication. This is used by Discourse for custom Auth0 authentication, e.g. Non-OAuth2 machine to machine authentication that relies on email / password authentication directly via the Auth0 API.

    - Scopes: ``read:email``

- Management. This is used by a number of rules and other processes in this system to read and update Auth0 data.

### 2. Setup the rules

You'll find the rules for this implementation in the ``auth0`` folder. The rules assume following rule settings (aka "rules-config"):

- ``shopify_api_key`` - From private Shopify app
- ``shopify_api_password`` - From private Shopify app
- ``shopify_domain`` - Default Shopify domain, i.e. something.myshopify.com
- ``shopify_store_domain`` - Shopify store domain, i.e. store.something.org
- ``discourse_domain`` - Discourse domain
- ``encryption_key`` - Random 32 character string, e.g ``53cb430c537d79dc74d59914235518efac845836``. This is used to encrypt Shopify passwords.
