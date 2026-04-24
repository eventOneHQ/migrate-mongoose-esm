### Example of using the CLI

After running `npm install @eventonehq/migrate-mongoose`, you will have the migration binary available to you as `npx migrate`.

##### Creating a Migration

You can simply create a new migration (e.g. `my_new_migration`) by running

```
$ npx migrate <options> create my_new_migration
```

where `<options>` must at a MINIMUM contain the database url (using the `-d`/`--dbConnectionUri` option).

##### Listing Migrations

This shows you the migrations with their current states.

_DOWN_ means the migrations has not been run yet
_UP_ means the migration has run and won't be running again

```
$ npx migrate <options> list
```

##### Running a Migration (Migrate UP)

Let's say your `migrate list` command shows

```
UP:  	  1450107140857-user-credit-to-vault.js
UP:  	  1452541801404-user-default-billing-to-default-billing-incoming.js
UP:  	  1461351953091-add_inventory.js
DOWN:	  1463003345598-add_processed_credit_cards.js
DOWN:  	  1463603842010-add_default_regional_settings.js
```

This means the first 3 migrations have run. You need to run the next 2 to be all up to date with the latest schema/data changes made by other developers.

simply run

```
$ npx migrate <options> up add_default_regional_settings
```

To migrate _UP TO (and including)_ `1463603842010-add_default_regional_settings.js`

Your new state will be

```
UP:  	  1450107140857-user-credit-to-vault.js
UP:  	  1452541801404-user-default-billing-to-default-billing-incoming.js
UP:  	  1461351953091-add_inventory.js
UP:	  1463003345598-add_processed_credit_cards.js
UP:  	  1463603842010-add_default_regional_settings.js
```

##### Undoing Migrations (Migrate DOWN)

What if you want to undo the previous step?

Simply run

```
$ npx migrate <options> down add_processed_credit_cards
```

and you'll migrate _DOWN TO (and including)_ `1463003345598-add_processed_credit_cards.js`

Your new state will be

```
UP:  	  1450107140857-user-credit-to-vault.js
UP:  	  1452541801404-user-default-billing-to-default-billing-incoming.js
UP:  	  1461351953091-add_inventory.js
DOWN:	  1463003345598-add_processed_credit_cards.js
DOWN:  	  1463603842010-add_default_regional_settings.js
```

##### Synchronizing Your DB with new Migrations

Lets say you `git pull` the latest changes from your project and someone had made a new migration called `add_unicorns` which adds much requested unicorns to your app.

When you run any migration command (e.g. `migrate list`), `migrate-mongoose` will automatically detect the new file and import it into the database with a state of DOWN.

Once imported, run `migrate up add_unicorns` to apply it.

If you no longer want a migration that exists in the database but not on the filesystem, run

```
$ npx migrate prune
```

and it will be removed from the database.
