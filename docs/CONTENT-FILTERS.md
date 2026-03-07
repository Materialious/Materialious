# What is Content filters?
Content filters allows you to conditionally filter content on Materialious based off attributes belonging to Channels & Videos. This allows you to hide content you find offensive, dislike or want to avoid.

# What is "Import Filters from URL"
Materialious allows you to import content filters from other sites, this can be powerful tool as you can write scripts what follows Materialious schema allowing you to generate massive content filters.

Enabling "Automatically update filter from URL" will mean Materialious automatically pulls any changes to the filter list from the provided URL.

# Understanding content filters

## Filter/Content type
Each filter represents a content type ("Video" or "Channel".) This content type dictates what attributes are available like author id, video id etc...

Each content type has one or more conditionals. These conditionals define what attributes must equal in order to filter a piece of content.

## Conditionals
### Field
This represents the attribute of the content type.

### Operators
- `equals` - Value must match exactly.
- `in` - Value is in an array.
- `like` - Value is in the string, e.g. "XYZ" is in "Channel XYZ".
- `gt` - Greater then value.
- `lt` - Less then value.
- `regex` - Define regex expression.

#### Value
Each conditional can have multiple values, each value acts as an "OR" operator. So if one value matches then the piece of content is filtered.

# Writing our schema with JSON (Advanced)
```json
{
  "version": "v2",  // Must be present
  "createdFor": "materialious",  // Must be present
  "filterBy": [  // Conditionals to filter by
    {
      "conditions": [
        {
          "operator": "equals",  // Exact match
          "field": "authorId",  // authorId attribute from video content type
          "values": [
            "UCH-_hzb2ILSCo9ftVSnrCIQ",  // Filter this video ID
            "UCLqH-U2TXzj1h7lyYQZLNQQ"   // or this video ID.
          ]
        }
      ],
      "type": "video" // The content type
    },
    {
      "conditions": [
        {
          "operator": "equals",
          "field": "authorId",
          "values": [
            "UCH-_hzb2ILSCo9ftVSnrCIQ"
          ]
        }
      ],
      "type": "channel"
    }
  ]
}
```
