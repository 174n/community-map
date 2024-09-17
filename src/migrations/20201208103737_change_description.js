
exports.up = async function(knex) {
  await knex.schema.table('users', function (table) {
    table.dropColumn('description');
  });
  await knex.schema.table('users', function (table) {
    table.text('description').nullable();
  });
};

exports.down = function(knex) {
  
};
