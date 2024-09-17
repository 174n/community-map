
exports.up = function(knex) {
  return knex.schema
    .createTable('users', function (table) {
      table.increments('id').primary();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.string('username', 255).nullable();
      table.integer('user_id', 255).unique().notNullable();
      table.string('name', 255).notNullable();
      table.string('city', 255).notNullable();
      table.string('city_data', 255).notNullable();
      table.float('lat').notNullable();
      table.float('lng').notNullable();
      table.string('description', 255).nullable();
      table.date('birthdate').nullable();
    });
};

exports.down = function(knex) {
  return knex.schema.dropTable("users");
};
