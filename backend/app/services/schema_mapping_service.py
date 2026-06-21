class SchemaMappingService:

    STANDARD_FIELDS = {
        "vendor": [
            "vendor",
            "vendor_name",
            "supplier",
            "supplier_name"
        ],

        "amount": [
            "amount",
            "txn_amt",
            "invoice_value",
            "payment_amount"
        ],

        "transaction_date": [
            "transaction_date",
            "date",
            "payment_date",
            "txn_date"
        ]
    }

    @staticmethod
    def generate_mapping(columns):

        mapping = {}

        for standard_field, aliases in (
            SchemaMappingService
            .STANDARD_FIELDS
            .items()
        ):

            for column in columns:

                if (
                    column.lower()
                    in [a.lower() for a in aliases]
                ):
                    mapping[standard_field] = column
                    break

        return mapping