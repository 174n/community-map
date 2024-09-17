
exports.up = async function (knex) {
  await knex.schema.table('users', function (table) {
    table.string('country').defaultTo('');
  });
};

exports.down = function (knex) {

};
